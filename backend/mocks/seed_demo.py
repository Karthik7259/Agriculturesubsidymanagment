"""Seed the mock cadastral registry + bank with realistic demonstration data.

Idempotent: re-running upserts parcels by parcel_id and bank accounts by farmer_id.

After running, the real subsidy pipeline hits:
 - /parcels/match on the land-records mock and gets back a true cadastral record
   with ownership + crop history per parcel.
 - /payouts on the bank mock, which posts real ledger entries against the
   pre-seeded farmer accounts, with realistic KYC and failure paths.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from mocks.db import bank_accounts, bank_txns, parcels, ensure_indexes


REGIONS = [
    # (state, district, taluka, anchor lat, anchor lng, typical crops, soil)
    ("Maharashtra", "Pune",        "Haveli",        18.5204, 73.8567, ["wheat", "sugarcane", "vegetables"], "black cotton"),
    ("Maharashtra", "Nashik",      "Niphad",        20.0110, 73.7900, ["grapes", "onion", "wheat"],         "medium black"),
    ("Maharashtra", "Aurangabad",  "Paithan",       19.8800, 75.3400, ["cotton", "maize", "pulses"],        "red loamy"),
    ("Maharashtra", "Solapur",     "Mohol",         17.6600, 75.9000, ["sugarcane", "jowar", "pulses"],     "black cotton"),
    ("Maharashtra", "Kolhapur",    "Karveer",       16.7050, 74.2433, ["sugarcane", "rice", "vegetables"],  "alluvial"),
    ("Maharashtra", "Nagpur",      "Kamptee",       21.1458, 79.0882, ["cotton", "soybean", "wheat"],       "black"),
]


NAMES = [
    "Ramesh Patil", "Ganesh More", "Suresh Kadam", "Vikas Shinde", "Anil Jadhav",
    "Sunil Pawar", "Dilip Bhosale", "Santosh Gaikwad", "Prakash Sawant", "Manoj Salunke",
    "Bhagwan Desai", "Nilesh Deshmukh", "Rajendra Thakur", "Kishor Chavan", "Vijay Mane",
    "Arun Khot", "Sadashiv Waghmare", "Balkrishna Phadke", "Sachin Kulkarni", "Milind Joshi",
    "Pandurang Gore", "Shivaji Kale", "Bharat Bagal", "Harish Ghorpade", "Ashok Karande",
    "Mahesh Nimbalkar", "Rohit Tambe", "Nitin Mokashi", "Subhash Khedkar", "Tukaram Bankar",
]


BANKS = [
    ("State Bank of India", "SBIN"),
    ("Bank of Maharashtra",  "MAHB"),
    ("HDFC Bank",           "HDFC"),
    ("ICICI Bank",          "ICIC"),
    ("Punjab National Bank", "PUNB"),
]


def _aadhaar_hash(seed: str) -> str:
    return "sha256:" + hashlib.sha256(f"AADHAAR-{seed}".encode()).hexdigest()[:16]


def _account_hash(seed: str) -> str:
    return "sha256:" + hashlib.sha256(f"ACCOUNT-{seed}".encode()).hexdigest()[:16]


def _polygon_around(lat: float, lng: float, size_deg: float, rng: random.Random) -> dict:
    """Axis-aligned rectangular parcel around (lat, lng). Small jitter for realism."""
    dlat = rng.uniform(-0.02, 0.02)
    dlng = rng.uniform(-0.02, 0.02)
    cx, cy = lng + dlng, lat + dlat
    hx, hy = size_deg, size_deg * 0.7
    ring = [
        [cx - hx, cy - hy],
        [cx + hx, cy - hy],
        [cx + hx, cy + hy],
        [cx - hx, cy + hy],
        [cx - hx, cy - hy],
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def _hectares_of(polygon: dict, lat: float) -> float:
    """Rough rectangular-area estimate in hectares at the given latitude."""
    import math
    ring = polygon["coordinates"][0]
    dlng = abs(ring[1][0] - ring[0][0])
    dlat = abs(ring[2][1] - ring[1][1])
    m_per_deg_lat = 111_320
    m_per_deg_lng = 111_320 * math.cos(math.radians(lat))
    area_m2 = (dlng * m_per_deg_lng) * (dlat * m_per_deg_lat)
    return round(area_m2 / 10_000, 3)


def _ownership_history(rng: random.Random, current_owner: str) -> list[dict]:
    n = rng.choice([0, 1, 2])
    out = []
    prev_owner = current_owner
    for i in range(n):
        new_prev = rng.choice(NAMES)
        if new_prev == prev_owner:
            continue
        start = datetime(1990 + rng.randint(0, 25), rng.randint(1, 12), rng.randint(1, 28))
        end = datetime(start.year + rng.randint(3, 20), rng.randint(1, 12), rng.randint(1, 28))
        out.append({
            "owner_name": new_prev,
            "owner_aadhaar_hash": _aadhaar_hash(new_prev),
            "from": start.isoformat(),
            "to": end.isoformat(),
            "transfer_type": rng.choice(["inheritance", "sale-deed", "partition", "gift-deed"]),
        })
        prev_owner = new_prev
    return out


def _crop_history(rng: random.Random, crops: list[str]) -> list[dict]:
    now = datetime.now(timezone.utc)
    seasons = []
    for i in range(rng.randint(3, 5)):
        year = now.year - (i // 2)
        season = "kharif" if i % 2 == 0 else "rabi"
        seasons.append({
            "season": f"{season}-{year}",
            "crop": rng.choice(crops),
            "yield_t_per_ha": round(rng.uniform(1.2, 5.6), 2),
            "verified_by": rng.choice(["village-officer", "drone-survey", "self-declared"]),
        })
    return seasons


def seed_parcels(count_per_region: int = 5) -> int:
    rng = random.Random(20260421)
    seeded = 0
    for ri, (state, district, taluka, lat, lng, crops, soil) in enumerate(REGIONS):
        for i in range(count_per_region):
            owner = rng.choice(NAMES)
            parcel_id = f"{state[:2].upper()}-{district[:3].upper()}-{ri:02d}{i:02d}"
            size_deg = rng.uniform(0.0008, 0.0025)
            polygon = _polygon_around(lat, lng, size_deg, rng)
            hectares = _hectares_of(polygon, lat)
            survey_no = f"{rng.randint(10, 250)}/{rng.choice(['A', 'B', 'C'])}"
            khata = str(rng.randint(1000, 9999))
            ownership_start = datetime(2000 + rng.randint(0, 22), rng.randint(1, 12), rng.randint(1, 28))

            doc = {
                "parcel_id": parcel_id,
                "state": state,
                "district": district,
                "taluka": taluka,
                "survey_no": survey_no,
                "khata_no": khata,
                "polygon": polygon,
                "total_hectares": hectares,
                "classification": rng.choices(
                    ["agricultural", "agricultural", "agricultural", "horticultural"],
                    k=1,
                )[0],
                "soil_type": soil,
                "irrigation_source": rng.choice(["canal", "borewell", "rainfed", "tank", "canal"]),
                "owner_name": owner,
                "owner_aadhaar_hash": _aadhaar_hash(owner + parcel_id),
                "ownership_since": ownership_start.isoformat(),
                "ownership_history": _ownership_history(rng, owner),
                "crop_history": _crop_history(rng, crops),
                "encumbrances": [],
                "disputes": [] if rng.random() > 0.05 else [{
                    "opened_at": (ownership_start + timedelta(days=400)).isoformat(),
                    "status": "resolved",
                    "reason": "boundary dispute",
                }],
                "updated_at": datetime.now(timezone.utc),
            }
            parcels.update_one({"parcel_id": parcel_id}, {"$set": doc}, upsert=True)
            seeded += 1
    return seeded


def seed_bank_accounts(limit: int = 20) -> int:
    """Create a starter bank account for the first N owners in the registry.

    Real applications create missing accounts on demand in the bank mock when a
    payout comes in — this seed is just to give the admin demo page something
    to show out-of-the-box.
    """
    rng = random.Random(20260422)
    seeded = 0
    seen = set()
    for p in parcels.find({}, {"owner_name": 1, "owner_aadhaar_hash": 1}).limit(limit * 2):
        owner = p.get("owner_name")
        if not owner or owner in seen:
            continue
        seen.add(owner)
        bank_name, ifsc_prefix = rng.choice(BANKS)
        farmer_id = f"DEMO-{p['owner_aadhaar_hash'][-6:].upper()}"
        account_no = str(rng.randint(10**10, 10**11 - 1))
        doc = {
            "farmer_id": farmer_id,
            "account_number_hash": _account_hash(account_no),
            "account_number_masked": f"XXXX{account_no[-4:]}",
            "bank_name": bank_name,
            "ifsc": f"{ifsc_prefix}0{rng.randint(100000, 999999)}",
            "name_on_account": owner,
            "kyc_status": rng.choices(
                ["VERIFIED", "VERIFIED", "VERIFIED", "PENDING"], k=1,
            )[0],
            "balance": round(rng.uniform(1_000, 50_000), 2),
            "frozen": False,
            "created_at": datetime.now(timezone.utc) - timedelta(days=rng.randint(60, 2000)),
        }
        bank_accounts.update_one({"farmer_id": farmer_id}, {"$set": doc}, upsert=True)
        seeded += 1
        if seeded >= limit:
            break
    return seeded


if __name__ == "__main__":
    ensure_indexes()
    p = seed_parcels()
    a = seed_bank_accounts()
    print(f"Seeded {p} parcels and {a} bank accounts into mocks DB.")
