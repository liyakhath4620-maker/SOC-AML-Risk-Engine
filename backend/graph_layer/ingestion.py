"""
Data Ingestion Module for the Unified SOC-AML Risk Engine.

Accepts a JSON array of mixed SOC and AML records and creates
interconnected nodes and relationships in Neo4j.

Each record must include a `record_type` field:
  - "cyber_alert"   → creates CyberAlert + UserAccount + IP/Device links
  - "transaction"   → creates Transaction + sender/receiver UserAccount nodes
  - "login_event"   → creates UserAccount → IPAddress / DeviceFingerprint links
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────
# Cypher templates for each record type
# ────────────────────────────────────────────────────────────────

_CYPHER_CYBER_ALERT = """
MERGE (u:UserAccount {account_id: $account_id})
  ON CREATE SET u.name           = $account_name,
                u.risk_score     = 0,
                u.created_at     = datetime()
SET u.risk_score = CASE WHEN $severity = 'critical' THEN 95
                        WHEN $severity = 'high'     THEN 75
                        WHEN $severity = 'medium'   THEN 50
                        ELSE 25 END

MERGE (a:CyberAlert {alert_id: $alert_id})
  ON CREATE SET a.alert_type   = $alert_type,
                a.severity     = $severity,
                a.description  = $description,
                a.timestamp    = $timestamp,
                a.source       = $source

MERGE (u)-[:TRIGGERED_ALERT]->(a)

WITH u, a
OPTIONAL MATCH (ip:IPAddress {address: $ip_address})
WITH u, a, ip
WHERE $ip_address IS NOT NULL
MERGE (ip2:IPAddress {address: $ip_address})
  ON CREATE SET ip2.geo_location = $geo_location,
                ip2.is_vpn       = $is_vpn
MERGE (u)-[:LOGGED_IN_FROM {timestamp: $timestamp}]->(ip2)
"""

_CYPHER_TRANSACTION = """
MERGE (sender:UserAccount {account_id: $sender_id})
  ON CREATE SET sender.name       = $sender_name,
                sender.risk_score = 0,
                sender.created_at = datetime()

MERGE (receiver:UserAccount {account_id: $receiver_id})
  ON CREATE SET receiver.name       = $receiver_name,
                receiver.risk_score = 0,
                receiver.created_at = datetime()

MERGE (tx:Transaction {tx_id: $tx_id})
  ON CREATE SET tx.amount      = $amount,
                tx.currency    = $currency,
                tx.timestamp   = $timestamp,
                tx.channel     = $channel,
                tx.status      = $status,
                tx.description = $description

MERGE (sender)-[:TRANSFERRED_TO {tx_id: $tx_id, amount: $amount}]->(receiver)

WITH sender, receiver, tx
WHERE $ip_address IS NOT NULL
MERGE (ip:IPAddress {address: $ip_address})
  ON CREATE SET ip.geo_location = $geo_location
MERGE (tx)-[:ASSOCIATED_WITH]->(ip)
"""

_CYPHER_LOGIN_EVENT = """
MERGE (u:UserAccount {account_id: $account_id})
  ON CREATE SET u.name       = $account_name,
                u.risk_score = 0,
                u.created_at = datetime()

WITH u
WHERE $ip_address IS NOT NULL
MERGE (ip:IPAddress {address: $ip_address})
  ON CREATE SET ip.geo_location = $geo_location,
                ip.is_vpn       = $is_vpn
MERGE (u)-[:LOGGED_IN_FROM {timestamp: $timestamp}]->(ip)

WITH u
WHERE $device_id IS NOT NULL
MERGE (d:DeviceFingerprint {fingerprint_id: $device_id})
  ON CREATE SET d.os         = $device_os,
                d.browser    = $device_browser,
                d.is_known   = $device_is_known
MERGE (u)-[:USED_DEVICE {timestamp: $timestamp}]->(d)
"""


def _safe_get(record: dict, key: str, default=None):
    """Safely retrieve a key from a record, returning default if missing."""
    return record.get(key, default)


def _process_record(tx, record: dict) -> str:
    """
    Route a single record to the correct Cypher template and execute it.

    Returns the record_type processed, or 'unknown' if unrecognised.
    """
    record_type = record.get("record_type", "unknown")

    if record_type == "cyber_alert":
        tx.run(_CYPHER_CYBER_ALERT, {
            "account_id":   record["account_id"],
            "account_name": _safe_get(record, "account_name", "Unknown"),
            "alert_id":     record["alert_id"],
            "alert_type":   record["alert_type"],
            "severity":     record.get("severity", "low"),
            "description":  record.get("description", ""),
            "timestamp":    record.get("timestamp", datetime.utcnow().isoformat()),
            "source":       record.get("source", "SOC"),
            "ip_address":   record.get("ip_address"),
            "geo_location": record.get("geo_location", "Unknown"),
            "is_vpn":       record.get("is_vpn", False),
        })
        return "cyber_alert"

    elif record_type == "transaction":
        tx.run(_CYPHER_TRANSACTION, {
            "sender_id":    record["sender_id"],
            "sender_name":  _safe_get(record, "sender_name", "Unknown"),
            "receiver_id":  record["receiver_id"],
            "receiver_name": _safe_get(record, "receiver_name", "Unknown"),
            "tx_id":        record["tx_id"],
            "amount":       record["amount"],
            "currency":     record.get("currency", "USD"),
            "timestamp":    record.get("timestamp", datetime.utcnow().isoformat()),
            "channel":      record.get("channel", "online"),
            "status":       record.get("status", "completed"),
            "description":  record.get("description", ""),
            "ip_address":   record.get("ip_address"),
            "geo_location": record.get("geo_location", "Unknown"),
        })
        return "transaction"

    elif record_type == "login_event":
        tx.run(_CYPHER_LOGIN_EVENT, {
            "account_id":    record["account_id"],
            "account_name":  _safe_get(record, "account_name", "Unknown"),
            "ip_address":    record.get("ip_address"),
            "geo_location":  record.get("geo_location", "Unknown"),
            "is_vpn":        record.get("is_vpn", False),
            "device_id":     record.get("device_id"),
            "device_os":     record.get("device_os", "Unknown"),
            "device_browser": record.get("device_browser", "Unknown"),
            "device_is_known": record.get("device_is_known", True),
            "timestamp":     record.get("timestamp", datetime.utcnow().isoformat()),
        })
        return "login_event"

    else:
        logger.warning("Unknown record_type: %s", record_type)
        return "unknown"


def ingest_data(driver, data: list[dict]) -> dict:
    """
    Ingest an array of SOC/AML records into Neo4j.

    Args:
        driver: A neo4j.Driver instance (or MockNeo4jDriver).
        data:   List of dicts, each with a `record_type` field.

    Returns:
        Summary dict with counts per record type and any errors.
    """
    if not data:
        return {"total": 0, "ingested": {}, "errors": 0, "message": "Empty payload — nothing to ingest."}

    counts: dict[str, int] = {}
    errors = 0

    with driver.session() as session:
        for idx, record in enumerate(data):
            try:
                result_type = session.execute_write(lambda tx, r=record: _process_record(tx, r))
                counts[result_type] = counts.get(result_type, 0) + 1
            except Exception as exc:
                errors += 1
                logger.error("Failed to ingest record %d: %s", idx, exc)

    summary = {
        "total":    len(data),
        "ingested": counts,
        "errors":   errors,
        "message":  f"Ingested {sum(counts.values())} of {len(data)} records.",
    }
    logger.info("Ingestion summary: %s", summary)
    return summary
