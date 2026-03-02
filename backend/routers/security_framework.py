"""
Security Framework Router — /api/v1/security-framework

Provides:
  GET  /api/v1/system-risk-score   → Aggregate mule ring probability score
  POST /api/v1/freeze-accounts     → Freeze compromised accounts
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from engine.threat_narrative import ThreatNarrativeEngine

router = APIRouter(prefix="/api/v1", tags=["Security Framework"])

# Singleton engine instance
_engine = ThreatNarrativeEngine(time_window_minutes=120)

# In-memory frozen accounts registry
_frozen_accounts: dict[str, dict] = {}


# ── Models ───────────────────────────────────────────────────

class SystemRiskScore(BaseModel):
    mule_ring_probability: float = Field(..., description="0.0–1.0 probability of active mule ring")
    total_threats_analyzed: int
    high_confidence_threats: int
    avg_confidence: float
    timestamp: str


class FreezeRequest(BaseModel):
    account_ids: List[str] = Field(..., description="List of account IDs to freeze")


class FreezeResponse(BaseModel):
    success: bool
    frozen_accounts: List[str]
    message: str
    timestamp: str


# ── Endpoints ────────────────────────────────────────────────

@router.get(
    "/system-risk-score",
    response_model=SystemRiskScore,
    summary="Get aggregate system risk score",
    description="Computes mule ring probability from all active threat data.",
)
async def get_system_risk_score(request: Request):
    store = request.app.state.store
    if store is None:
        return SystemRiskScore(
            mule_ring_probability=0.0,
            total_threats_analyzed=0,
            high_confidence_threats=0,
            avg_confidence=0.0,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    # Extract breaches and transactions from the graph store
    breaches = []
    transactions = []

    for key, node in store.nodes.items():
        label = node.get("_label", "")
        if label == "CyberAlert":
            breach = {
                "alert_id": node.get("alert_id"),
                "alert_type": node.get("alert_type", "unknown"),
                "severity": node.get("severity", "low"),
                "description": node.get("description", ""),
                "timestamp": node.get("timestamp"),
                "source": node.get("source", "SOC"),
            }
            for rel in store.relationships:
                if rel["_type"] == "TRIGGERED_ALERT" and rel["_dst"] == key:
                    src_node = store.nodes.get(rel["_src"], {})
                    breach["account_id"] = src_node.get("account_id", "")
                    breach["account_name"] = src_node.get("name", "Unknown")
                    for r2 in store.relationships:
                        if r2["_type"] == "LOGGED_IN_FROM" and r2["_src"] == rel["_src"]:
                            ip_node = store.nodes.get(r2["_dst"], {})
                            breach["ip_address"] = ip_node.get("address", "")
                            break
                    break
            breaches.append(breach)
        elif label == "Transaction":
            tx = {
                "tx_id": node.get("tx_id"),
                "amount": node.get("amount", 0),
                "currency": node.get("currency", "USD"),
                "timestamp": node.get("timestamp"),
                "channel": node.get("channel", ""),
                "status": node.get("status", "completed"),
                "description": node.get("description", ""),
            }
            for rel in store.relationships:
                if rel["_type"] == "TRANSFERRED_TO" and rel.get("tx_id") == tx["tx_id"]:
                    src_node = store.nodes.get(rel["_src"], {})
                    dst_node = store.nodes.get(rel["_dst"], {})
                    tx["sender_id"] = src_node.get("account_id", "")
                    tx["sender_name"] = src_node.get("name", "Unknown")
                    tx["receiver_id"] = dst_node.get("account_id", "")
                    tx["receiver_name"] = dst_node.get("name", "Unknown")
                    break
            transactions.append(tx)

    if not breaches and not transactions:
        return SystemRiskScore(
            mule_ring_probability=0.0,
            total_threats_analyzed=0,
            high_confidence_threats=0,
            avg_confidence=0.0,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    results = _engine.analyze_batch(breaches, transactions)

    total = len(results)
    high_conf = sum(1 for r in results if r["confidence_score"] >= 0.70)
    avg_conf = sum(r["confidence_score"] for r in results) / total if total > 0 else 0.0

    # Mule ring probability: weighted combination of high confidence ratio and average
    mule_prob = min(
        (high_conf / max(total, 1)) * 0.6 + avg_conf * 0.4,
        1.0,
    )

    return SystemRiskScore(
        mule_ring_probability=round(mule_prob, 4),
        total_threats_analyzed=total,
        high_confidence_threats=high_conf,
        avg_confidence=round(avg_conf, 4),
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


@router.post(
    "/freeze-accounts",
    response_model=FreezeResponse,
    summary="Freeze compromised accounts",
    description="Marks specified accounts as FROZEN in the system registry.",
)
async def freeze_accounts(payload: FreezeRequest, request: Request):
    if not payload.account_ids:
        raise HTTPException(status_code=400, detail="No account IDs provided")

    frozen = []
    for account_id in payload.account_ids:
        _frozen_accounts[account_id] = {
            "account_id": account_id,
            "status": "FROZEN",
            "frozen_at": datetime.utcnow().isoformat() + "Z",
            "frozen_by": "SOC-AML Automated Framework",
        }
        frozen.append(account_id)

    # Also update the threat table status if available
    from routers.threats import _active_threats
    for threat_id, threat in _active_threats.items():
        td = threat.threat_data or {}
        breach_account = td.get("breach_details", {}).get("account_id", "")
        sender_id = td.get("transaction_details", {}).get("sender_id", "")
        receiver_id = td.get("transaction_details", {}).get("receiver_id", "")

        if breach_account in frozen or sender_id in frozen or receiver_id in frozen:
            if threat.status != "Confirmed Mule Ring":
                threat.status = "Confirmed Mule Ring"

    return FreezeResponse(
        success=True,
        frozen_accounts=frozen,
        message=f"Successfully frozen {len(frozen)} account(s). SAR filing initiated.",
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


@router.get(
    "/frozen-accounts",
    summary="List all frozen accounts",
    description="Returns all accounts currently marked as FROZEN.",
)
async def list_frozen_accounts():
    return {
        "frozen_accounts": list(_frozen_accounts.values()),
        "total": len(_frozen_accounts),
    }
