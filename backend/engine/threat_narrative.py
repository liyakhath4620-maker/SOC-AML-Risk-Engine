"""
Threat Narrative Engine — Module 3

A standalone, importable Python class that evaluates the linkage between
cyber breaches and subsequent financial transactions to detect coordinated
money mule operations.

Usage:
    from engine.threat_narrative import ThreatNarrativeEngine

    engine = ThreatNarrativeEngine(time_window_minutes=60)
    result = engine.analyze(cyber_breach, transaction)
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────
# Severity weights for confidence scoring
# ────────────────────────────────────────────────────────────────
_SEVERITY_WEIGHTS = {
    "critical": 1.0,
    "high": 0.8,
    "medium": 0.5,
    "low": 0.2,
}

_ALERT_TYPE_RISK = {
    "account_takeover": 1.0,
    "phishing": 0.9,
    "sim_swap": 0.95,
    "credential_stuffing": 0.85,
    "malware": 0.8,
    "anomalous_behavior": 0.6,
    "rapid_movement": 0.7,
    "crypto_offramp": 0.75,
}


class ThreatNarrativeEngine:
    """
    Evaluates cyber breach → financial transaction linkage.

    Given a detected cyber breach and a subsequent financial transaction,
    the engine assesses whether the transaction is a direct consequence
    of the breach and generates a structured risk narrative.
    """

    def __init__(self, time_window_minutes: int = 120):
        """
        Args:
            time_window_minutes: Maximum gap (in minutes) between a breach
                                 and a transaction for them to be considered
                                 temporally linked. Default: 120 min.
        """
        self.time_window = timedelta(minutes=time_window_minutes)

    # ── public API ──────────────────────────────────────────────

    def analyze(self, cyber_breach: dict, transaction: dict) -> dict:
        """
        Analyze a single breach–transaction pair.

        Args:
            cyber_breach: Dict with keys: alert_id, account_id, alert_type,
                          severity, timestamp, ip_address, description, ...
            transaction:  Dict with keys: tx_id, sender_id, receiver_id,
                          amount, timestamp, ip_address, ...

        Returns:
            Structured risk payload with confidence score and narrative.
        """
        breach_time = self._parse_time(cyber_breach.get("timestamp"))
        tx_time = self._parse_time(transaction.get("timestamp"))

        # ── temporal analysis ───────────────────────────────────
        is_temporal_link = False
        time_delta_minutes: Optional[float] = None

        if breach_time and tx_time:
            delta = tx_time - breach_time
            time_delta_minutes = delta.total_seconds() / 60
            is_temporal_link = (0 <= time_delta_minutes <= self.time_window.total_seconds() / 60)

        # ── account linkage ─────────────────────────────────────
        breach_account = cyber_breach.get("account_id", "")
        tx_sender = transaction.get("sender_id", "")
        is_same_account = (breach_account == tx_sender) and breach_account != ""

        # ── IP correlation ──────────────────────────────────────
        breach_ip = cyber_breach.get("ip_address", "")
        tx_ip = transaction.get("ip_address", "")
        is_same_ip = (breach_ip == tx_ip) and breach_ip != ""

        # ── confidence scoring ──────────────────────────────────
        confidence = self._calculate_confidence(
            is_temporal_link=is_temporal_link,
            is_same_account=is_same_account,
            is_same_ip=is_same_ip,
            severity=cyber_breach.get("severity", "low"),
            alert_type=cyber_breach.get("alert_type", ""),
            amount=transaction.get("amount", 0),
            time_delta_minutes=time_delta_minutes,
        )

        risk_level = self._classify_risk(confidence)

        # ── narrative generation ────────────────────────────────
        narrative = self._generate_narrative(
            cyber_breach=cyber_breach,
            transaction=transaction,
            is_temporal_link=is_temporal_link,
            is_same_account=is_same_account,
            is_same_ip=is_same_ip,
            time_delta_minutes=time_delta_minutes,
            confidence=confidence,
            risk_level=risk_level,
        )

        linkage_evidence = []
        if is_temporal_link:
            linkage_evidence.append(
                f"Transaction occurred {time_delta_minutes:.0f} min after breach"
            )
        if is_same_account:
            linkage_evidence.append(
                f"Breached account {breach_account} is the transaction sender"
            )
        if is_same_ip:
            linkage_evidence.append(
                f"Shared IP address: {breach_ip}"
            )

        payload = {
            "risk_level": risk_level,
            "confidence_score": round(confidence, 3),
            "narrative": narrative,
            "breach_details": {
                "alert_id": cyber_breach.get("alert_id"),
                "alert_type": cyber_breach.get("alert_type"),
                "severity": cyber_breach.get("severity"),
                "account_id": breach_account,
                "account_name": cyber_breach.get("account_name", "Unknown"),
                "timestamp": cyber_breach.get("timestamp"),
                "ip_address": breach_ip,
                "description": cyber_breach.get("description", ""),
            },
            "transaction_details": {
                "tx_id": transaction.get("tx_id"),
                "sender_id": tx_sender,
                "sender_name": transaction.get("sender_name", "Unknown"),
                "receiver_id": transaction.get("receiver_id"),
                "receiver_name": transaction.get("receiver_name", "Unknown"),
                "amount": transaction.get("amount"),
                "currency": transaction.get("currency", "USD"),
                "timestamp": transaction.get("timestamp"),
                "status": transaction.get("status", "unknown"),
            },
            "linkage_evidence": linkage_evidence,
            "recommended_action": self._recommend_action(risk_level, transaction),
            "analysis_timestamp": datetime.utcnow().isoformat() + "Z",
        }

        logger.info(
            "Analysis complete: %s (confidence=%.2f) for breach=%s → tx=%s",
            risk_level, confidence,
            cyber_breach.get("alert_id"), transaction.get("tx_id"),
        )
        return payload

    def analyze_batch(self, breaches: list[dict], transactions: list[dict]) -> list[dict]:
        """
        Cross-analyze all breaches against all transactions and return
        only those pairs with non-negligible risk.

        Returns a list of risk payloads sorted by confidence (descending).
        """
        results = []
        for breach in breaches:
            for tx in transactions:
                result = self.analyze(breach, tx)
                if result["confidence_score"] >= 0.3:
                    results.append(result)

        results.sort(key=lambda r: r["confidence_score"], reverse=True)
        return results

    # ── private helpers ─────────────────────────────────────────

    @staticmethod
    def _parse_time(ts: Optional[str]) -> Optional[datetime]:
        if not ts:
            return None
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def _calculate_confidence(
        is_temporal_link: bool,
        is_same_account: bool,
        is_same_ip: bool,
        severity: str,
        alert_type: str,
        amount: float,
        time_delta_minutes: Optional[float],
    ) -> float:
        score = 0.0

        # Temporal proximity (max 0.35)
        if is_temporal_link and time_delta_minutes is not None:
            if time_delta_minutes <= 15:
                score += 0.35
            elif time_delta_minutes <= 30:
                score += 0.30
            elif time_delta_minutes <= 60:
                score += 0.25
            else:
                score += 0.15

        # Account linkage (0.25)
        if is_same_account:
            score += 0.25

        # IP correlation (0.15)
        if is_same_ip:
            score += 0.15

        # Severity weight (max 0.15)
        severity_w = _SEVERITY_WEIGHTS.get(severity, 0.1)
        score += severity_w * 0.15

        # Alert type risk (max 0.10)
        alert_w = _ALERT_TYPE_RISK.get(alert_type, 0.3)
        score += alert_w * 0.10

        # High-value transaction bonus (up to 0.05)
        if amount >= 10000:
            score += 0.05
        elif amount >= 5000:
            score += 0.03

        return min(score, 1.0)

    @staticmethod
    def _classify_risk(confidence: float) -> str:
        if confidence >= 0.80:
            return "CRITICAL"
        elif confidence >= 0.60:
            return "HIGH"
        elif confidence >= 0.40:
            return "MEDIUM"
        elif confidence >= 0.20:
            return "LOW"
        else:
            return "INFORMATIONAL"

    @staticmethod
    def _generate_narrative(
        cyber_breach: dict,
        transaction: dict,
        is_temporal_link: bool,
        is_same_account: bool,
        is_same_ip: bool,
        time_delta_minutes: Optional[float],
        confidence: float,
        risk_level: str,
    ) -> str:
        breach_type = cyber_breach.get("alert_type", "unknown breach").replace("_", " ").title()
        account = cyber_breach.get("account_name", cyber_breach.get("account_id", "Unknown"))
        amount = transaction.get("amount", 0)
        currency = transaction.get("currency", "USD")
        receiver = transaction.get("receiver_name", transaction.get("receiver_id", "Unknown"))

        parts = [
            f"⚠️ {risk_level} RISK — Confidence: {confidence:.0%}",
            "",
            f"A **{breach_type}** attack targeting account **{account}** "
            f"was detected at {cyber_breach.get('timestamp', 'unknown time')}.",
        ]

        if is_temporal_link and time_delta_minutes is not None:
            parts.append(
                f"Within **{time_delta_minutes:.0f} minutes** of the breach, "
                f"a transaction of **{currency} {amount:,.2f}** was initiated "
                f"to **{receiver}**."
            )
        else:
            parts.append(
                f"A transaction of **{currency} {amount:,.2f}** was sent to **{receiver}**."
            )

        if is_same_account:
            parts.append(
                "The compromised account is the **direct sender** of these funds."
            )

        if is_same_ip:
            parts.append(
                f"Both the breach and transaction originated from the **same IP** "
                f"({cyber_breach.get('ip_address', 'unknown')})."
            )

        if risk_level in ("CRITICAL", "HIGH"):
            parts.append("")
            parts.append(
                "**RECOMMENDED ACTION**: Immediately freeze the recipient account "
                "and escalate to the AML/Fraud investigation team."
            )

        return "\n".join(parts)

    @staticmethod
    def _recommend_action(risk_level: str, transaction: dict) -> str:
        status = transaction.get("status", "completed")

        if risk_level == "CRITICAL":
            if status == "pending":
                return "BLOCK_TRANSACTION — Hold pending transaction and freeze all linked accounts immediately."
            return "FREEZE_ACCOUNTS — Pre-emptive freeze on sender and receiver accounts. Initiate SAR filing."

        elif risk_level == "HIGH":
            if status == "pending":
                return "HOLD_FOR_REVIEW — Suspend transaction pending manual review by AML team."
            return "ENHANCED_MONITORING — Place all linked accounts under enhanced transaction monitoring."

        elif risk_level == "MEDIUM":
            return "FLAG_FOR_REVIEW — Add to daily AML review queue for analyst investigation."

        else:
            return "MONITOR — Continue standard monitoring, no immediate action required."
