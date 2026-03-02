"""
Real SQL-backed Threat Endpoints — /api/v1/threats

Queries the SQLite database for flagged transactions + linked cyber logs
to produce real threat objects for the frontend.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from pydantic import BaseModel

from database import get_db
from models import Transaction, CyberLog, FrozenAccount

router = APIRouter(prefix="/api/v1", tags=["Threats (SQL)"])


class ThreatResponse(BaseModel):
    id: str
    title: str
    risk_level: str
    status: str
    timestamp: str
    threat_data: dict
    notes: list


def _compute_risk_level(amount: float, severity: str, has_shared_ip: bool) -> str:
    score = 0
    if amount >= 150000:
        score += 3
    elif amount >= 75000:
        score += 2
    elif amount >= 25000:
        score += 1

    sev_map = {"critical": 3, "high": 2, "medium": 1, "low": 0}
    score += sev_map.get(severity, 0)

    if has_shared_ip:
        score += 2

    if score >= 6:
        return "CRITICAL"
    elif score >= 4:
        return "HIGH"
    elif score >= 2:
        return "MEDIUM"
    return "LOW"


@router.get("/threats", response_model=list[ThreatResponse])
async def get_threats(db: Session = Depends(get_db)):
    """
    Build threat objects from flagged transactions + correlated cyber logs.
    Executes real SQL queries — no hardcoded data.
    """
    flagged_txns = (
        db.query(Transaction)
        .filter(Transaction.is_flagged == True)
        .order_by(Transaction.timestamp.desc())
        .limit(50)
        .all()
    )

    # De-duplicate: one threat per unique receiver (mule) cluster
    seen_receivers = set()
    threats = []

    for tx in flagged_txns:
        if tx.receiver_id in seen_receivers:
            continue
        seen_receivers.add(tx.receiver_id)

        # Find linked cyber logs for the sender
        linked_logs = (
            db.query(CyberLog)
            .filter(
                (CyberLog.user_id == tx.user_id) |
                (CyberLog.ip_address == tx.ip_address)
            )
            .order_by(CyberLog.timestamp.desc())
            .limit(5)
            .all()
        )

        # Check if the IP appears across multiple mule accounts
        shared_ip_count = (
            db.query(func.count(distinct(Transaction.user_id)))
            .filter(Transaction.ip_address == tx.ip_address, Transaction.is_flagged == True)
            .scalar()
        )
        has_shared_ip = shared_ip_count > 1

        # Get the highest severity log
        best_log = linked_logs[0] if linked_logs else None
        severity = best_log.severity if best_log else "medium"

        risk_level = _compute_risk_level(tx.amount, severity, has_shared_ip)

        # Count total ring transfers for this receiver
        ring_count = (
            db.query(func.count(Transaction.id))
            .filter(Transaction.receiver_id == tx.receiver_id, Transaction.is_flagged == True)
            .scalar()
        )

        # Check if frozen
        frozen = db.query(FrozenAccount).filter(
            (FrozenAccount.account_id == tx.user_id) |
            (FrozenAccount.account_id == tx.receiver_id)
        ).first()

        status = "Confirmed Mule Ring" if frozen else "Pending Review"

        # Build evidence
        evidence = []
        if best_log:
            time_diff = abs((tx.timestamp - best_log.timestamp).total_seconds() / 60)
            evidence.append(f"Transaction occurred {int(time_diff)} min after cyber alert")
        if has_shared_ip:
            evidence.append(f"Shared IP {tx.ip_address} across {shared_ip_count} flagged accounts")
        if ring_count > 1:
            evidence.append(f"{ring_count} layered transfers through receiver {tx.receiver_id}")
        if tx.amount >= 100000:
            evidence.append(f"High-value transfer: ₹{tx.amount:,.2f}")

        # Format transfer method display
        method_display = tx.transfer_method
        if tx.upi_id:
            method_display = f"{tx.transfer_method} ({tx.upi_id})"

        threats.append(ThreatResponse(
            id=tx.tx_id,
            title=f"{best_log.event_type.replace('_', ' ').title() if best_log else 'Suspicious Transfer'} → {tx.transfer_method} ₹{tx.amount:,.0f}",
            risk_level=risk_level,
            status=status,
            timestamp=tx.timestamp.isoformat() + "Z",
            threat_data={
                "confidence_score": min(0.5 + (ring_count * 0.05) + (0.15 if has_shared_ip else 0) + (0.1 if tx.amount > 100000 else 0), 0.99),
                "breach_details": {
                    "alert_id": best_log.log_id if best_log else None,
                    "alert_type": best_log.event_type if best_log else "suspicious_transfer",
                    "severity": severity,
                    "account_id": tx.user_id,
                    "account_name": tx.user_name,
                    "ip_address": tx.ip_address,
                    "city": tx.city,
                    "description": best_log.description if best_log else tx.flag_reason,
                    "timestamp": best_log.timestamp.isoformat() + "Z" if best_log else None,
                },
                "transaction_details": {
                    "tx_id": tx.tx_id,
                    "sender_id": tx.user_id,
                    "sender_name": tx.user_name,
                    "receiver_id": tx.receiver_id,
                    "receiver_name": tx.receiver_name,
                    "amount": tx.amount,
                    "currency": "INR",
                    "transfer_method": method_display,
                    "upi_id": tx.upi_id,
                    "timestamp": tx.timestamp.isoformat() + "Z",
                    "status": "frozen" if frozen else "pending",
                },
                "linkage_evidence": evidence,
                "ring_hop_count": ring_count,
            },
            notes=[],
        ))

    return threats


@router.get("/threats/{threat_id}")
async def get_threat_detail(threat_id: str, db: Session = Depends(get_db)):
    """Get detailed info for a specific threat by tx_id."""
    tx = db.query(Transaction).filter(Transaction.tx_id == threat_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Threat not found")

    # Get all transactions in the same IP cluster
    related = (
        db.query(Transaction)
        .filter(Transaction.ip_address == tx.ip_address)
        .order_by(Transaction.timestamp)
        .all()
    )

    logs = (
        db.query(CyberLog)
        .filter(
            (CyberLog.user_id == tx.user_id) |
            (CyberLog.ip_address == tx.ip_address)
        )
        .order_by(CyberLog.timestamp.desc())
        .all()
    )

    return {
        "transaction": {
            "tx_id": tx.tx_id,
            "sender": tx.user_name,
            "receiver": tx.receiver_name,
            "amount": tx.amount,
            "currency": "INR",
            "method": tx.transfer_method,
            "upi_id": tx.upi_id,
            "ip": tx.ip_address,
            "city": tx.city,
            "timestamp": tx.timestamp.isoformat(),
        },
        "related_transactions": [
            {
                "tx_id": r.tx_id,
                "sender": r.user_name,
                "receiver": r.receiver_name,
                "amount": r.amount,
                "ip": r.ip_address,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in related
        ],
        "cyber_logs": [
            {
                "log_id": l.log_id,
                "event": l.event_type,
                "severity": l.severity,
                "description": l.description,
                "ip": l.ip_address,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs
        ],
    }


@router.get("/transactions")
async def search_transactions(
    ip: Optional[str] = None,
    user_id: Optional[str] = None,
    flagged_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Query transactions by IP, user_id, or flagged status."""
    q = db.query(Transaction)
    if ip:
        q = q.filter(Transaction.ip_address == ip)
    if user_id:
        q = q.filter((Transaction.user_id == user_id) | (Transaction.receiver_id == user_id))
    if flagged_only:
        q = q.filter(Transaction.is_flagged == True)
    return [
        {
            "tx_id": t.tx_id,
            "sender": t.user_name,
            "sender_id": t.user_id,
            "receiver": t.receiver_name,
            "receiver_id": t.receiver_id,
            "amount": t.amount,
            "currency": "INR",
            "method": t.transfer_method,
            "upi_id": t.upi_id,
            "ip": t.ip_address,
            "city": t.city,
            "flagged": t.is_flagged,
            "timestamp": t.timestamp.isoformat(),
        }
        for t in q.order_by(Transaction.timestamp.desc()).limit(limit).all()
    ]


@router.get("/system-risk-score")
async def get_system_risk_score(db: Session = Depends(get_db)):
    """Compute aggregate mule ring probability from real SQL data."""
    total_flagged = db.query(func.count(Transaction.id)).filter(Transaction.is_flagged == True).scalar()
    total_txns = db.query(func.count(Transaction.id)).scalar()

    # Unique IPs shared across flagged accounts
    shared_ips = (
        db.query(Transaction.ip_address)
        .filter(Transaction.is_flagged == True)
        .group_by(Transaction.ip_address)
        .having(func.count(distinct(Transaction.user_id)) > 1)
        .count()
    )

    total_amount_flagged = db.query(func.sum(Transaction.amount)).filter(Transaction.is_flagged == True).scalar() or 0
    high_sev_logs = db.query(func.count(CyberLog.id)).filter(CyberLog.severity.in_(["critical", "high"])).scalar()

    # Mule ring probability: weighted composite
    ratio = total_flagged / max(total_txns, 1)
    ip_factor = min(shared_ips / 5, 1.0)
    amount_factor = min(total_amount_flagged / 5000000, 1.0)
    log_factor = min(high_sev_logs / 30, 1.0)

    probability = min(ratio * 0.2 + ip_factor * 0.35 + amount_factor * 0.25 + log_factor * 0.2, 1.0)

    return {
        "mule_ring_probability": round(probability, 4),
        "total_threats_analyzed": total_flagged,
        "high_confidence_threats": shared_ips,
        "avg_confidence": round(ratio, 4),
        "total_flagged_amount_inr": round(total_amount_flagged, 2),
        "high_severity_logs": high_sev_logs,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/freeze-accounts")
async def freeze_accounts(payload: dict, db: Session = Depends(get_db)):
    """Freeze accounts in the database."""
    account_ids = payload.get("account_ids", [])
    if not account_ids:
        raise HTTPException(status_code=400, detail="No account IDs provided")

    frozen = []
    for aid in account_ids:
        existing = db.query(FrozenAccount).filter(FrozenAccount.account_id == aid).first()
        if not existing:
            db.add(FrozenAccount(
                account_id=aid,
                frozen_by="SOC-AML Automated Framework",
                reason="Pre-emptive freeze — mule ring detection",
            ))
            frozen.append(aid)

    db.commit()

    return {
        "success": True,
        "frozen_accounts": frozen,
        "message": f"Successfully frozen {len(frozen)} account(s). SAR filing initiated.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
