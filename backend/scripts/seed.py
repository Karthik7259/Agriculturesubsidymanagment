"""Seed a set of realistic Indian agricultural schemes + an admin user.

Idempotent: safe to re-run. Will upsert schemes by scheme_id and create the
admin user only if one with phone 9999999999 does not already exist.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import farmers, schemes, ensure_indexes
from app.security import hash_password


SCHEMES = [
    {
        "scheme_id": "S-PM-KISAN",
        "scheme_name": "PM-KISAN Samman Nidhi",
        "description": "Rs 6,000 per year income support to landholding farmers.",
        "crop_required": "any",
        "min_land_hectares": 0.0,
        "max_land_hectares": 100.0,
        "max_income": 1_500_000.0,
        "eligible_states": [],
        "benefit_amount": 6000.0,
    },
    {
        "scheme_id": "S-FERTILIZER-SUBSIDY",
        "scheme_name": "Urea Fertilizer Subsidy",
        "description": "Per-hectare subsidy on urea for foodgrain cultivators.",
        "crop_required": "any",
        "min_land_hectares": 0.25,
        "max_land_hectares": 10.0,
        "max_income": 800_000.0,
        "eligible_states": [],
        "benefit_amount": 2500.0,
    },
    {
        "scheme_id": "S-PADDY-MSP-BONUS",
        "scheme_name": "Paddy MSP Bonus",
        "description": "Bonus payment for paddy cultivators during kharif season.",
        "crop_required": "rice",
        "min_land_hectares": 0.5,
        "max_land_hectares": 15.0,
        "max_income": 1_000_000.0,
        "eligible_states": ["Punjab", "Haryana", "Uttar Pradesh", "Maharashtra", "Odisha"],
        "benefit_amount": 8000.0,
    },
    {
        "scheme_id": "S-WHEAT-PROCUREMENT",
        "scheme_name": "Wheat Procurement Incentive",
        "description": "Incentive paid to wheat farmers selling at APMC.",
        "crop_required": "wheat",
        "min_land_hectares": 0.5,
        "max_land_hectares": 15.0,
        "max_income": 1_000_000.0,
        "eligible_states": ["Punjab", "Haryana", "Uttar Pradesh", "Madhya Pradesh", "Maharashtra"],
        "benefit_amount": 7500.0,
    },
    {
        "scheme_id": "S-SUGARCANE-SUPPORT",
        "scheme_name": "Sugarcane Price Support",
        "description": "Fair and remunerative price support for cane growers.",
        "crop_required": "sugarcane",
        "min_land_hectares": 0.5,
        "max_land_hectares": 20.0,
        "max_income": 1_200_000.0,
        "eligible_states": ["Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu"],
        "benefit_amount": 10000.0,
    },
    {
        "scheme_id": "S-COTTON-SUBSIDY",
        "scheme_name": "Cotton Cultivation Subsidy",
        "description": "Input subsidy for cotton growers in rain-fed regions.",
        "crop_required": "cotton",
        "min_land_hectares": 1.0,
        "max_land_hectares": 20.0,
        "max_income": 900_000.0,
        "eligible_states": ["Maharashtra", "Gujarat", "Telangana", "Andhra Pradesh"],
        "benefit_amount": 9000.0,
    },
    {
        "scheme_id": "S-DROUGHT-RELIEF",
        "scheme_name": "Drought Relief Assistance",
        "description": "One-time assistance for farmers in notified drought-hit districts.",
        "crop_required": "any",
        "min_land_hectares": 0.1,
        "max_land_hectares": 5.0,
        "max_income": 500_000.0,
        "eligible_states": ["Maharashtra", "Karnataka", "Rajasthan", "Telangana"],
        "benefit_amount": 12000.0,
    },
    {
        "scheme_id": "S-ORGANIC-CONVERSION",
        "scheme_name": "Organic Farming Conversion Grant",
        "description": "Grant for farmers transitioning from conventional to organic.",
        "crop_required": "any",
        "min_land_hectares": 0.5,
        "max_land_hectares": 10.0,
        "max_income": 700_000.0,
        "eligible_states": [],
        "benefit_amount": 15000.0,
    },
    {
        "scheme_id": "S-MICRO-IRRIGATION",
        "scheme_name": "Micro-Irrigation Subsidy",
        "description": "Subsidy on drip and sprinkler system installation.",
        "crop_required": "any",
        "min_land_hectares": 0.5,
        "max_land_hectares": 10.0,
        "max_income": 900_000.0,
        "eligible_states": [],
        "benefit_amount": 20000.0,
    },
    {
        "scheme_id": "S-CROP-INSURANCE-BONUS",
        "scheme_name": "PMFBY Premium Support",
        "description": "Extra support on crop-insurance premium for small farmers.",
        "crop_required": "any",
        "min_land_hectares": 0.25,
        "max_land_hectares": 4.0,
        "max_income": 600_000.0,
        "eligible_states": [],
        "benefit_amount": 3000.0,
    },
]


def seed_schemes() -> None:
    for s in SCHEMES:
        schemes.update_one(
            {"scheme_id": s["scheme_id"]},
            {"$set": {**s, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    print(f"Upserted {len(SCHEMES)} schemes.")


def seed_admin() -> None:
    if farmers.find_one({"phone": "9999999999"}):
        print("Admin already exists, skipping.")
        return
    farmers.insert_one(
        {
            "farmer_id": "ADMIN-0001",
            "full_name": "System Admin",
            "phone": "9999999999",
            "hashed_password": hash_password("admin123"),
            "state": "Maharashtra",
            "district": "Pune",
            "annual_income": 0.0,
            "role": "admin",
            "created_at": datetime.now(timezone.utc),
        }
    )
    print("Created admin: phone=9999999999  password=admin123")


if __name__ == "__main__":
    ensure_indexes()
    seed_schemes()
    seed_admin()
    print("Seed complete.")
