"""
Threat Intel Router — /api/v1/threat-intel

  GET  → Auto-analyse all ingested data to find breach–transaction linkages
  POST → Manually submit a breach + transaction pair for analysis
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional

from engine.threat_narrative import ThreatNarrativeEngine

router = APIRouter(prefix="/api/v1", tags=["Threat Intelligence"])

# Singleton engine instance
_engine = ThreatNarrativeEngine(time_window_minutes=120)


# ── Request / Response models ────────────────────────────────────
class ManualAnalysisRequest(BaseModel):
    cyber_breach: dict = Field(..., description="Cyber breach / alert record")
    transaction: dict = Field(..., description="Financial transaction record")


class ThreatIntelResponse(BaseModel):
    total_threats: int
    high_confidence_count: int
    threats: list[dict]


# ── Endpoints ────────────────────────────────────────────────────

@router.get(
    "/threat-intel",
    response_model=ThreatIntelResponse,
    summary="Auto-analyse all graph data for linked threats",
    description=(
        "Cross-references every cyber breach against every transaction "
        "in the graph and returns pairs with non-negligible risk."
    ),
)
async def auto_analyze(request: Request):
    store = request.app.state.store
    if store is None:
        raise HTTPException(
            status_code=503,
            detail="Graph store not available.",
        )

    # Extract breaches and transactions from the in-memory store
    breaches = []
    transactions = []

    for key, node in store.nodes.items():
        label = node.get("_label", "")
        if label == "CyberAlert":
            # Reconstruct a breach dict from the stored node + find the linked account
            breach = {
                "alert_id": node.get("alert_id"),
                "alert_type": node.get("alert_type", "unknown"),
                "severity": node.get("severity", "low"),
                "description": node.get("description", ""),
                "timestamp": node.get("timestamp"),
                "source": node.get("source", "SOC"),
            }
            # Find the account that triggered this alert
            for rel in store.relationships:
                if rel["_type"] == "TRIGGERED_ALERT" and rel["_dst"] == key:
                    src_node = store.nodes.get(rel["_src"], {})
                    breach["account_id"] = src_node.get("account_id", "")
                    breach["account_name"] = src_node.get("name", "Unknown")
                    # Find IP from LOGGED_IN_FROM for that account
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
            # Find sender and receiver
            for rel in store.relationships:
                if rel["_type"] == "TRANSFERRED_TO":
                    # Check if this tx matches via tx_id in rel props
                    if rel.get("tx_id") == tx["tx_id"]:
                        src_node = store.nodes.get(rel["_src"], {})
                        dst_node = store.nodes.get(rel["_dst"], {})
                        tx["sender_id"] = src_node.get("account_id", "")
                        tx["sender_name"] = src_node.get("name", "Unknown")
                        tx["receiver_id"] = dst_node.get("account_id", "")
                        tx["receiver_name"] = dst_node.get("name", "Unknown")
                        break
            # Find IP from ASSOCIATED_WITH
            for rel in store.relationships:
                if rel["_type"] == "ASSOCIATED_WITH" and rel["_src"] == key:
                    ip_node = store.nodes.get(rel["_dst"], {})
                    tx["ip_address"] = ip_node.get("address", "")
                    break
            transactions.append(tx)

    if not breaches and not transactions:
        return ThreatIntelResponse(
            total_threats=0,
            high_confidence_count=0,
            threats=[],
        )

    # Run batch analysis
    results = _engine.analyze_batch(breaches, transactions)

    high_confidence = sum(
        1 for r in results if r["confidence_score"] >= 0.70
    )

    return ThreatIntelResponse(
        total_threats=len(results),
        high_confidence_count=high_confidence,
        threats=results,
    )


@router.post(
    "/threat-intel",
    summary="Manually analyse a breach–transaction pair",
    description=(
        "Submit a specific cyber breach and a financial transaction "
        "for linkage analysis. Returns a structured risk narrative."
    ),
)
async def manual_analyze(payload: ManualAnalysisRequest):
    try:
        result = _engine.analyze(payload.cyber_breach, payload.transaction)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")

    return result
