"""
SQLAlchemy ORM Models — Transaction, CyberLog, AiCache
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text

from database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tx_id = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(String(30), nullable=False, index=True)
    user_name = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(5), default="INR")
    transfer_method = Column(String(20), nullable=False)  # UPI, IMPS, NEFT
    upi_id = Column(String(80), nullable=True)
    receiver_id = Column(String(30), nullable=True, index=True)
    receiver_name = Column(String(100), nullable=True)
    ip_address = Column(String(50), nullable=True, index=True)
    city = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_flagged = Column(Boolean, default=False, index=True)
    flag_reason = Column(String(200), nullable=True)


class CyberLog(Base):
    __tablename__ = "cyber_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    log_id = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(String(30), nullable=False, index=True)
    user_name = Column(String(100), nullable=False)
    event_type = Column(String(50), nullable=False)  # e.g. aadhaar_phishing, fake_kyc_sms
    severity = Column(String(20), nullable=False)  # critical, high, medium, low
    ip_address = Column(String(50), nullable=True, index=True)
    city = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AiCache(Base):
    __tablename__ = "ai_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_hash = Column(String(64), unique=True, nullable=False, index=True)
    threat_narrative = Column(Text, nullable=False)
    threat_context = Column(Text, nullable=True)  # JSON of input params
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FrozenAccount(Base):
    __tablename__ = "frozen_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(String(30), unique=True, nullable=False, index=True)
    frozen_by = Column(String(100), default="SOC-AML Automated Framework")
    frozen_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    reason = Column(String(200), nullable=True)
