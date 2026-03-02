"""
Smart AI Analysis Endpoint — /api/v1/analyze

Hash-based cache to throttle Gemini API calls:
1. SHA-256 hash of request params
2. Check AiCache table
3. If hit → return cached narrative (0 API calls)
4. If miss → single Gemini call → store in cache → return
"""

import hashlib
import json
import os
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import AiCache, Transaction, CyberLog

logger = logging.getLogger("soc_aml.analyze")

router = APIRouter(prefix="/api/v1", tags=["AI Analysis"])


class AnalyzeRequest(BaseModel):
    user_id: Optional[str] = None
    transaction_id: Optional[str] = None
    ip_address: Optional[str] = None
    threat_title: Optional[str] = None
    amount: Optional[float] = None
    message: Optional[str] = None


class AnalyzeResponse(BaseModel):
    narrative: str
    cached: bool
    request_hash: str
    timestamp: str


def _compute_hash(params: dict) -> str:
    """SHA-256 hash of the request params for cache lookup."""
    canonical = json.dumps(params, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _build_threat_context(req: AnalyzeRequest, db: Session) -> str:
    """Build a rich text prompt from real database queries."""
    context_parts = []

    if req.transaction_id:
        tx = db.query(Transaction).filter(Transaction.tx_id == req.transaction_id).first()
        if tx:
            context_parts.append(f"""
Transaction Details:
- TX ID: {tx.tx_id}
- Sender: {tx.user_name} ({tx.user_id}) from {tx.city}
- Receiver: {tx.receiver_name} ({tx.receiver_id})
- Amount: ₹{tx.amount:,.2f} via {tx.transfer_method}
- UPI ID: {tx.upi_id or 'N/A'}
- IP: {tx.ip_address}
- Flagged: {tx.is_flagged} — {tx.flag_reason or 'No reason'}
""")

    if req.user_id:
        txns = db.query(Transaction).filter(
            (Transaction.user_id == req.user_id) | (Transaction.receiver_id == req.user_id)
        ).order_by(Transaction.timestamp.desc()).limit(10).all()

        if txns:
            context_parts.append(f"\nRecent transactions for {req.user_id}:")
            for t in txns:
                context_parts.append(
                    f"  - {t.tx_id}: {t.user_name} → {t.receiver_name}, "
                    f"₹{t.amount:,.2f} via {t.transfer_method}, "
                    f"IP: {t.ip_address}, Flagged: {t.is_flagged}"
                )

    if req.ip_address:
        ip_txns = db.query(Transaction).filter(Transaction.ip_address == req.ip_address).all()
        ip_logs = db.query(CyberLog).filter(CyberLog.ip_address == req.ip_address).all()
        context_parts.append(f"\nIP {req.ip_address} activity: {len(ip_txns)} transactions, {len(ip_logs)} cyber logs")

    target_user = req.user_id
    target_ip = req.ip_address
    if target_user or target_ip:
        logs = db.query(CyberLog).filter(
            (CyberLog.user_id == target_user) if target_user else (CyberLog.ip_address == target_ip)
        ).order_by(CyberLog.timestamp.desc()).limit(5).all()

        if logs:
            context_parts.append("\nCorrelated Cyber Alerts:")
            for l in logs:
                context_parts.append(
                    f"  - [{l.severity.upper()}] {l.event_type}: {l.description} "
                    f"(IP: {l.ip_address}, {l.timestamp.isoformat()})"
                )

    return "\n".join(context_parts) if context_parts else "No specific threat context available."


def _generate_fallback_narrative(req: AnalyzeRequest, context: str) -> str:
    """Local fallback when Gemini is unavailable."""
    title = req.threat_title or "Suspicious Activity"
    amount_str = f"₹{req.amount:,.2f}" if req.amount else "undetermined amount"

    return f"""## Threat Analysis: {title}

**Analysis Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC

### Summary
A suspicious pattern has been detected involving {amount_str} in financial transfers potentially linked to cyber breach activity. The system has identified correlated indicators across transaction records and cyber security logs.

### Key Findings
{context}

### Risk Assessment
Based on the available data, this activity pattern is consistent with a **coordinated money mule operation**. The temporal proximity between cyber alerts and high-value transfers, combined with shared IP infrastructure, suggests an organized threat actor.

### Recommended Actions
1. **Immediate**: Freeze associated accounts pending investigation
2. **Short-term**: Escalate to AML compliance team for SAR filing
3. **Long-term**: Add identified IPs and UPI IDs to the watchlist

*This analysis was generated locally. AI-enhanced analysis will resume when the Gemini service is available.*"""


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_threat(req: AnalyzeRequest, db: Session = Depends(get_db)):
    """
    Smart cached AI analysis endpoint.
    1. Hash request params
    2. Check cache
    3. If miss → Gemini call → cache → return
    """
    # Build hash from request params
    hash_input = {
        "user_id": req.user_id,
        "transaction_id": req.transaction_id,
        "ip_address": req.ip_address,
        "amount": req.amount,
        "message": req.message,
    }
    request_hash = _compute_hash(hash_input)

    # ── Cache Check ──────────────────────────────────────────
    cached = db.query(AiCache).filter(AiCache.request_hash == request_hash).first()
    if cached:
        logger.info(f"Cache HIT for hash {request_hash[:12]}...")
        return AnalyzeResponse(
            narrative=cached.threat_narrative,
            cached=True,
            request_hash=request_hash,
            timestamp=cached.timestamp.isoformat() + "Z",
        )

    # ── Cache Miss → Build Context + AI Call ─────────────────
    logger.info(f"Cache MISS for hash {request_hash[:12]}... building context")
    context = _build_threat_context(req, db)

    narrative = ""
    api_key = os.getenv("GOOGLE_API_KEY", "")

    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")

            prompt = f"""You are an elite threat analyst in a Unified SOC-AML Risk Engine for an Indian financial institution.
Analyze the following threat data and produce a concise, actionable threat narrative.

{context}

Analyst Query: {req.message or "Provide a complete threat analysis."}

Guidelines:
- Use Indian financial context (INR, UPI, IMPS, NEFT, Aadhaar, PAN)
- Explain the breach→financial linkage clearly
- Highlight IP correlations and temporal proximity
- Recommend specific actions (freeze, SAR filing, watchlist)
- Use markdown formatting with headers, bold, bullets
- Be concise and authoritative"""

            result = model.generate_content(prompt)
            narrative = result.text
            logger.info("Gemini API call successful")
        except Exception as e:
            logger.warning(f"Gemini API failed: {e}. Using fallback.")
            narrative = _generate_fallback_narrative(req, context)
    else:
        logger.info("No GOOGLE_API_KEY set. Using local fallback narrative.")
        narrative = _generate_fallback_narrative(req, context)

    # ── Store in Cache ───────────────────────────────────────
    cache_entry = AiCache(
        request_hash=request_hash,
        threat_narrative=narrative,
        threat_context=json.dumps(hash_input, default=str),
    )
    db.add(cache_entry)
    db.commit()

    return AnalyzeResponse(
        narrative=narrative,
        cached=False,
        request_hash=request_hash,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
