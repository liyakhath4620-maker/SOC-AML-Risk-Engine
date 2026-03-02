"""
Neo4j Schema Definitions for the Unified SOC-AML Risk Engine.

Nodes:
  - UserAccount      : Bank/platform user account
  - Transaction      : Financial transaction record
  - IPAddress         : Network IP address
  - DeviceFingerprint : Browser/device fingerprint
  - CyberAlert        : SOC security alert (phishing, malware, ATO, etc.)

Relationships:
  - TRANSFERRED_TO    : UserAccount → UserAccount (via Transaction)
  - LOGGED_IN_FROM    : UserAccount → IPAddress
  - USED_DEVICE       : UserAccount → DeviceFingerprint
  - TRIGGERED_ALERT   : UserAccount → CyberAlert
  - ASSOCIATED_WITH   : Transaction → IPAddress
"""

import logging

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────
# Cypher statements to create constraints and indexes
# ────────────────────────────────────────────────────────────────

CONSTRAINTS = [
    # Uniqueness constraints on natural keys
    "CREATE CONSTRAINT IF NOT EXISTS FOR (u:UserAccount)      REQUIRE u.account_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (t:Transaction)      REQUIRE t.tx_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (ip:IPAddress)        REQUIRE ip.address IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (d:DeviceFingerprint) REQUIRE d.fingerprint_id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (a:CyberAlert)       REQUIRE a.alert_id IS UNIQUE",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS FOR (u:UserAccount)      ON (u.risk_score)",
    "CREATE INDEX IF NOT EXISTS FOR (t:Transaction)      ON (t.timestamp)",
    "CREATE INDEX IF NOT EXISTS FOR (a:CyberAlert)       ON (a.severity)",
    "CREATE INDEX IF NOT EXISTS FOR (a:CyberAlert)       ON (a.alert_type)",
]


def initialize_schema(driver) -> dict:
    """
    Idempotently create all constraints and indexes in Neo4j.

    Args:
        driver: A neo4j.Driver instance (or MockNeo4jDriver).

    Returns:
        dict with counts of constraints and indexes applied.
    """
    stats = {"constraints_applied": 0, "indexes_applied": 0}

    with driver.session() as session:
        for stmt in CONSTRAINTS:
            try:
                session.run(stmt)
                stats["constraints_applied"] += 1
                logger.info("Applied: %s", stmt[:60])
            except Exception as exc:
                logger.warning("Constraint skipped (%s): %s", exc, stmt[:60])

        for stmt in INDEXES:
            try:
                session.run(stmt)
                stats["indexes_applied"] += 1
                logger.info("Applied: %s", stmt[:60])
            except Exception as exc:
                logger.warning("Index skipped (%s): %s", exc, stmt[:60])

    logger.info("Schema initialization complete: %s", stats)
    return stats
