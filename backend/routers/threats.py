from typing import Optional, List
from datetime import datetime
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from engine.threat_narrative import ThreatNarrativeEngine

router = APIRouter(prefix="/api/v1/threats", tags=["Threat Management"])

# In-memory store for active threats
# Key: Threat ID (often maps to a transaction ID or a UUID for manual entry)
_active_threats = {}

# We'll use the existing engine to auto-populate the store
_engine = ThreatNarrativeEngine(time_window_minutes=120)

# --- Models ---

class ThreatStatusUpdate(BaseModel):
    status: str = Field(..., description="E.g., Investigating, Confirmed Mule Ring, False Positive")
    note: Optional[str] = Field(None, description="Optional note to append")

class ManualThreatCreate(BaseModel):
    title: str = Field(..., description="Short title for the manual indicator")
    description: str = Field(..., description="Detailed description")
    indicator_type: str = Field(..., description="E.g., IP Address, Email, Account ID")
    indicator_value: str = Field(..., description="The suspicious value")
    risk_level: str = Field("MEDIUM", description="Risk level (CRITICAL, HIGH, MEDIUM, LOW)")

class ThreatNote(BaseModel):
    timestamp: str
    text: str
    author: str = "Analyst"

class ActiveThreat(BaseModel):
    id: str
    title: str
    risk_level: str
    status: str = "Pending Review"
    timestamp: str
    threat_data: dict = Field(default_factory=dict)
    notes: List[ThreatNote] = Field(default_factory=list)

# --- Routes ---

@router.get("", response_model=List[ActiveThreat])
async def get_threats(request: Request):
    """Fetch all active threats."""
    global _active_threats
    
    # If the store is empty, try to auto-populate from the graph once
    if not _active_threats:
        _auto_populate_threats(request)
        
    # Return as a list sorted by timestamp (newest first)
    threat_list = list(_active_threats.values())
    threat_list.sort(key=lambda x: x.timestamp, reverse=True)
    return threat_list

@router.post("", response_model=ActiveThreat)
async def create_manual_threat(threat_in: ManualThreatCreate):
    """Manually enter a new suspicious indicator."""
    new_id = f"MANUAL-{uuid.uuid4().hex[:8].upper()}"
    new_threat = ActiveThreat(
        id=new_id,
        title=threat_in.title,
        risk_level=threat_in.risk_level,
        status="Investigating",
        timestamp=datetime.utcnow().isoformat() + "Z",
        threat_data={
            "description": threat_in.description,
            "indicator_type": threat_in.indicator_type,
            "indicator_value": threat_in.indicator_value,
            "source": "Manual Analyst Entry"
        }
    )
    _active_threats[new_id] = new_threat
    return new_threat

@router.patch("/{threat_id}", response_model=ActiveThreat)
async def update_threat(threat_id: str, update: ThreatStatusUpdate):
    """Update threat status and optionally add a note."""
    if threat_id not in _active_threats:
        raise HTTPException(status_code=404, detail="Threat not found")
        
    threat = _active_threats[threat_id]
    threat.status = update.status
    
    if update.note:
        threat.notes.append(ThreatNote(
            timestamp=datetime.utcnow().isoformat() + "Z",
            text=update.note
        ))
        
    return threat

@router.delete("/{threat_id}")
async def dismiss_threat(threat_id: str):
    """Dismiss/archive a threat, removing it from the active view."""
    if threat_id not in _active_threats:
        raise HTTPException(status_code=404, detail="Threat not found")
        
    del _active_threats[threat_id]
    return {"status": "success", "message": f"Threat {threat_id} dismissed."}

# --- Helper ---

def _auto_populate_threats(request: Request):
    """Reads graph data and populates initial high-confidence threats."""
    store = request.app.state.store
    if store is None:
        return
        
    breaches = []
    transactions = []

    # Extract base logic from threat_intel.py
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
            for rel in store.relationships:
                if rel["_type"] == "ASSOCIATED_WITH" and rel["_src"] == key:
                    ip_node = store.nodes.get(rel["_dst"], {})
                    tx["ip_address"] = ip_node.get("address", "")
                    break
            transactions.append(tx)

    results = _engine.analyze_batch(breaches, transactions)
    
    # Just take the top 15 highest confidence threats for the active board
    for r in results[:15]:
        tx_id = r["transaction_details"]["tx_id"]
        _active_threats[tx_id] = ActiveThreat(
            id=tx_id,
            title=f"{r['breach_details']['alert_type'].replace('_', ' ').title()} \u2192 Financial Movement",
            risk_level=r["risk_level"],
            status="Pending Review",
            timestamp=r["transaction_details"]["timestamp"] or datetime.utcnow().isoformat() + "Z",
            threat_data=r
        )
