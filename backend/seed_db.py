"""
seed_db.py — Populate the SQLite database with 500 rows of realistic
Indian-localized transaction + cyber log data.

Includes a hidden "mule ring" pattern across 5 accounts for demo detection.

Usage:
    cd backend
    python seed_db.py
"""

import random
import hashlib
from datetime import datetime, timedelta, timezone

from database import engine, SessionLocal, Base
from models import Transaction, CyberLog

# ── Indian Context Data ──────────────────────────────────────────

INDIAN_NAMES = [
    "Rajesh Sharma", "Priya Patel", "Amit Kumar", "Sunita Devi", "Vikram Singh",
    "Ananya Iyer", "Rohit Verma", "Sneha Reddy", "Deepak Mishra", "Kavita Nair",
    "Arjun Mehta", "Pooja Gupta", "Sanjay Joshi", "Meera Krishnan", "Nikhil Agarwal",
    "Divya Banerjee", "Ravi Yadav", "Lakshmi Rao", "Suresh Pillai", "Neha Saxena",
    "Manish Tiwari", "Shruti Deshmukh", "Gaurav Chauhan", "Pallavi Kulkarni", "Arun Bhat",
    "Simran Kaur", "Vivek Pandey", "Rekha Menon", "Abhishek Jain", "Swati Choudhary",
]

INDIAN_CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad",
    "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Lucknow",
    "Kochi", "Chandigarh", "Indore", "Nagpur", "Coimbatore",
]

# IP ranges loosely mapped to Indian ISPs
CITY_IP_MAP = {
    "Mumbai": "103.21.", "Delhi": "103.25.", "Bangalore": "49.207.",
    "Chennai": "59.96.", "Hyderabad": "183.82.", "Pune": "106.51.",
    "Kolkata": "14.139.", "Ahmedabad": "27.58.", "Jaipur": "1.22.",
    "Lucknow": "117.247.", "Kochi": "119.82.", "Chandigarh": "14.143.",
    "Indore": "43.250.", "Nagpur": "157.49.", "Coimbatore": "115.96.",
}

UPI_SUFFIXES = ["@ybl", "@paytm", "@oksbi", "@okaxis", "@upi", "@ibl", "@kotak"]

TRANSFER_METHODS = ["UPI", "IMPS", "NEFT"]
TRANSFER_WEIGHTS = [0.6, 0.25, 0.15]  # UPI most common

CYBER_EVENT_TYPES = [
    ("aadhaar_pan_phishing", "critical", "Aadhaar-PAN link phishing attempt detected"),
    ("fake_kyc_sms", "high", "Fake KYC update SMS with malicious link"),
    ("sim_swap_attempt", "critical", "SIM swap request detected — 2FA bypass risk"),
    ("upi_pin_brute_force", "high", "Multiple failed UPI PIN attempts"),
    ("credential_stuffing", "high", "Credential stuffing from known botnet"),
    ("suspicious_login", "medium", "Login from unusual location/device"),
    ("malware_banking_trojan", "critical", "Banking trojan detected on mobile endpoint"),
    ("social_engineering_call", "medium", "Vishing call reported — fake bank executive"),
    ("qr_code_scam", "high", "QR code payment scam — reversed transaction flow"),
    ("fake_upi_app", "high", "Fake UPI payment screenshot shared"),
    ("account_takeover", "critical", "Unauthorized session — password changed"),
    ("data_scraping", "low", "Automated scraping of user profile data"),
]

# ── Mule Ring Definition ─────────────────────────────────────────
# 5 linked accounts that form a mule ring
MULE_RING = {
    "accounts": [
        {"id": "MULE-ACC-001", "name": "Rajan Malhotra", "upi": "rajan.m@ybl", "city": "Mumbai"},
        {"id": "MULE-ACC-002", "name": "Farid Sheikh", "upi": "farid.s@paytm", "city": "Delhi"},
        {"id": "MULE-ACC-003", "name": "Pradeep Gowda", "upi": "p.gowda@oksbi", "city": "Bangalore"},
        {"id": "MULE-ACC-004", "name": "Sonia Kapoor", "upi": "sonia.k@okaxis", "city": "Hyderabad"},
        {"id": "MULE-ACC-005", "name": "Vikrant Thapar", "upi": "v.thapar@ybl", "city": "Pune"},
    ],
    "orchestrator_ip": "185.220.101.34",  # Known TOR exit node
    "attack_ip": "91.234.56.78",
}


def generate_ip(city: str) -> str:
    prefix = CITY_IP_MAP.get(city, "103.21.")
    return f"{prefix}{random.randint(1,254)}.{random.randint(1,254)}"


def generate_upi_id(name: str) -> str:
    parts = name.lower().split()
    handle = f"{parts[0]}.{parts[-1][0]}" if len(parts) > 1 else parts[0]
    return f"{handle}{random.choice(UPI_SUFFIXES)}"


def seed():
    """Populate DB with 500 rows: ~400 normal + ~60 mule ring + ~40 cyber logs."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    now = datetime.now(timezone.utc)
    transactions = []
    cyber_logs = []
    tx_counter = 0

    # ── Generate Normal Transactions (350) ───────────────────────
    for i in range(350):
        city = random.choice(INDIAN_CITIES)
        sender_name = random.choice(INDIAN_NAMES)
        receiver_name = random.choice(INDIAN_NAMES)
        while receiver_name == sender_name:
            receiver_name = random.choice(INDIAN_NAMES)

        method = random.choices(TRANSFER_METHODS, weights=TRANSFER_WEIGHTS, k=1)[0]

        # Normal amounts: ₹500–₹50,000
        amount = round(random.uniform(500, 50000), 2)
        if random.random() < 0.1:
            amount = round(random.uniform(50000, 150000), 2)  # occasional high-value

        tx_counter += 1
        t_offset = random.randint(0, 72 * 60)  # within last 72 hours
        ts = now - timedelta(minutes=t_offset)
        sender_id = f"ACC-{hashlib.md5(sender_name.encode()).hexdigest()[:6].upper()}"
        receiver_id = f"ACC-{hashlib.md5(receiver_name.encode()).hexdigest()[:6].upper()}"

        transactions.append(Transaction(
            tx_id=f"TXN-{tx_counter:05d}",
            user_id=sender_id,
            user_name=sender_name,
            amount=amount,
            currency="INR",
            transfer_method=method,
            upi_id=generate_upi_id(sender_name) if method == "UPI" else None,
            receiver_id=receiver_id,
            receiver_name=receiver_name,
            ip_address=generate_ip(city),
            city=city,
            timestamp=ts,
            is_flagged=False,
        ))

    # ── Generate Mule Ring Transactions (60) ─────────────────────
    # Pattern: Money flows Victim → MULE-001 → MULE-002 → ... → MULE-005 → Cash out
    # High amounts, rapid succession, cross-city, shared IP anomalies
    mule_accs = MULE_RING["accounts"]
    attack_ip = MULE_RING["orchestrator_ip"]

    for cycle in range(12):  # 12 cycles × 5 hops = 60 transactions
        base_time = now - timedelta(minutes=random.randint(5, 300))
        cycle_amount = round(random.uniform(75000, 250000), 2)  # High value: ₹75K–₹2.5L

        # Victim → MULE-001
        victim_name = random.choice(INDIAN_NAMES)
        victim_id = f"VIC-{hashlib.md5(f'{victim_name}{cycle}'.encode()).hexdigest()[:6].upper()}"
        tx_counter += 1
        transactions.append(Transaction(
            tx_id=f"TXN-{tx_counter:05d}",
            user_id=victim_id,
            user_name=victim_name,
            amount=cycle_amount,
            currency="INR",
            transfer_method="UPI",
            upi_id=generate_upi_id(victim_name),
            receiver_id=mule_accs[0]["id"],
            receiver_name=mule_accs[0]["name"],
            ip_address=attack_ip if random.random() < 0.4 else generate_ip(random.choice(INDIAN_CITIES)),
            city=random.choice(INDIAN_CITIES),
            timestamp=base_time,
            is_flagged=True,
            flag_reason="High-value transfer post cyber-alert; shared attacker IP",
        ))

        # MULE chain: 001→002→003→004→005
        for hop in range(4):
            tx_counter += 1
            hop_amount = round(cycle_amount * (0.95 - hop * 0.02), 2)  # small cuts
            hop_time = base_time + timedelta(minutes=(hop + 1) * random.randint(2, 8))
            src = mule_accs[hop]
            dst = mule_accs[hop + 1]

            transactions.append(Transaction(
                tx_id=f"TXN-{tx_counter:05d}",
                user_id=src["id"],
                user_name=src["name"],
                amount=hop_amount,
                currency="INR",
                transfer_method=random.choice(["UPI", "IMPS"]),
                upi_id=src["upi"],
                receiver_id=dst["id"],
                receiver_name=dst["name"],
                ip_address=attack_ip if random.random() < 0.6 else generate_ip(src["city"]),
                city=src["city"],
                timestamp=hop_time,
                is_flagged=True,
                flag_reason=f"Mule ring hop {hop+1} — rapid layered transfer",
            ))

    # ── Generate Cyber Logs (90) ─────────────────────────────────
    # ~50 linked to mule ring accounts, ~40 general
    for i in range(50):
        mule = random.choice(mule_accs)
        event = random.choice(CYBER_EVENT_TYPES[:7])  # higher-severity for mule ring
        log_time = now - timedelta(minutes=random.randint(10, 350))

        cyber_logs.append(CyberLog(
            log_id=f"SOC-2026-{5000 + i}",
            user_id=mule["id"],
            user_name=mule["name"],
            event_type=event[0],
            severity=event[1],
            ip_address=attack_ip if random.random() < 0.5 else generate_ip(mule["city"]),
            city=mule["city"],
            description=f"{event[2]} — linked to account {mule['id']} ({mule['name']})",
            timestamp=log_time,
        ))

    for i in range(40):
        city = random.choice(INDIAN_CITIES)
        name = random.choice(INDIAN_NAMES)
        user_id = f"ACC-{hashlib.md5(name.encode()).hexdigest()[:6].upper()}"
        event = random.choice(CYBER_EVENT_TYPES)
        log_time = now - timedelta(minutes=random.randint(10, 4320))

        cyber_logs.append(CyberLog(
            log_id=f"SOC-2026-{5050 + i}",
            user_id=user_id,
            user_name=name,
            event_type=event[0],
            severity=event[1],
            ip_address=generate_ip(city),
            city=city,
            description=f"{event[2]} — account {user_id}",
            timestamp=log_time,
        ))

    # ── Commit ───────────────────────────────────────────────────
    db.add_all(transactions)
    db.add_all(cyber_logs)
    db.commit()

    total_tx = db.query(Transaction).count()
    flagged_tx = db.query(Transaction).filter(Transaction.is_flagged == True).count()
    total_logs = db.query(CyberLog).count()

    print(f"✓ Seeded database successfully!")
    print(f"  Transactions: {total_tx} ({flagged_tx} flagged)")
    print(f"  Cyber Logs:   {total_logs}")
    print(f"  Mule Ring:    {len(mule_accs)} accounts, {12 * 5} ring transactions")

    db.close()


if __name__ == "__main__":
    seed()
