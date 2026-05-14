"""Seed a set of realistic Indian agricultural schemes + an admin user.

Idempotent: safe to re-run. Will upsert schemes by scheme_id and create the
admin user only if one with phone 9999999999 does not already exist.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import farmers, government_profiles, land_records, schemes, ensure_indexes
from app.security import hash_password
from app.services.income import aadhaar_hash


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


SYNTHETIC_PROFILES = [
    {
        "aadhaar_number": "111122223333",
        "personal": {
            "full_name": "Ramesh Patil",
            "age": 44,
            "gender": "Male",
            "address": "Wagholi, Haveli, Pune, Maharashtra",
            "contact_details": {"mobile": "9000000001"},
        },
        "land_records": [{
            "land_id": "LND-MH-PUN-001",
            "survey_number": "245/A",
            "ownership_details": "Self owned",
            "land_area_ha": 2.48,
            "soil_type": "black cotton",
            "irrigation_availability": "borewell",
            "village": "Wagholi",
            "taluk": "Haveli",
            "district": "Pune",
            "state": "Maharashtra",
            "polygon": {"type": "Polygon", "coordinates": [[[73.8567, 18.5204], [73.8588, 18.5204], [73.8588, 18.5221], [73.8567, 18.5221], [73.8567, 18.5204]]]},
        }],
        "financial": {
            "annual_income": 372000,
            "subsidy_history": [{"scheme_id": "S-PM-KISAN", "year": 2025, "amount": 6000}],
            "loan_details": [{"bank": "State Bank of India", "type": "KCC", "outstanding": 85000}],
            "insurance_details": [{"scheme": "PMFBY", "crop": "wheat", "status": "active"}],
        },
        "agriculture": {
            "previously_cultivated_crops": ["wheat", "sugarcane", "vegetables"],
            "crop_history": [{"season": "rabi-2025", "crop": "wheat", "yield_t_per_ha": 3.6}, {"season": "kharif-2025", "crop": "sugarcane", "yield_t_per_ha": 72.0}],
            "yield_records": [{"crop": "wheat", "year": 2025, "yield_t_per_ha": 3.6}],
            "existing_government_scheme_benefits": ["PM-KISAN"],
        },
        "farmer_category": "medium",
    },
    {
        "aadhaar_number": "222233334444",
        "personal": {
            "full_name": "Meena Sharma",
            "age": 37,
            "gender": "Female",
            "address": "Niphad, Nashik, Maharashtra",
            "contact_details": {"mobile": "9000000002"},
        },
        "land_records": [{
            "land_id": "LND-MH-NAS-002",
            "survey_number": "88/B",
            "ownership_details": "Joint ownership",
            "land_area_ha": 1.15,
            "soil_type": "medium black",
            "irrigation_availability": "canal",
            "village": "Niphad",
            "taluk": "Niphad",
            "district": "Nashik",
            "state": "Maharashtra",
            "polygon": {"type": "Polygon", "coordinates": [[[73.7900, 20.0110], [73.7913, 20.0110], [73.7913, 20.0121], [73.7900, 20.0121], [73.7900, 20.0110]]]},
        }],
        "financial": {
            "annual_income": 210000,
            "subsidy_history": [],
            "loan_details": [],
            "insurance_details": [{"scheme": "PMFBY", "crop": "rice", "status": "expired"}],
        },
        "agriculture": {
            "previously_cultivated_crops": ["rice", "wheat", "pulses"],
            "crop_history": [{"season": "kharif-2025", "crop": "rice", "yield_t_per_ha": 4.1}],
            "yield_records": [{"crop": "rice", "year": 2025, "yield_t_per_ha": 4.1}],
            "existing_government_scheme_benefits": [],
        },
        "farmer_category": "small",
    },
    {
        "aadhaar_number": "333344445555",
        "personal": {
            "full_name": "Kiran Gowda",
            "age": 51,
            "gender": "Male",
            "address": "Mandya, Karnataka",
            "contact_details": {"mobile": "9000000003"},
        },
        "land_records": [{
            "land_id": "LND-KA-MAN-003",
            "survey_number": "17/C",
            "ownership_details": "Self owned",
            "land_area_ha": 3.7,
            "soil_type": "red loamy",
            "irrigation_availability": "canal",
            "village": "Maddur",
            "taluk": "Maddur",
            "district": "Mandya",
            "state": "Karnataka",
            "polygon": {"type": "Polygon", "coordinates": [[[77.0400, 12.5200], [77.0422, 12.5200], [77.0422, 12.5220], [77.0400, 12.5220], [77.0400, 12.5200]]]},
        }],
        "financial": {
            "annual_income": 560000,
            "subsidy_history": [{"scheme_id": "S-MICRO-IRRIGATION", "year": 2024, "amount": 12000}],
            "loan_details": [{"bank": "Canara Bank", "type": "Crop loan", "outstanding": 130000}],
            "insurance_details": [],
        },
        "agriculture": {
            "previously_cultivated_crops": ["sugarcane", "maize"],
            "crop_history": [{"season": "kharif-2025", "crop": "sugarcane", "yield_t_per_ha": 78.4}],
            "yield_records": [{"crop": "sugarcane", "year": 2025, "yield_t_per_ha": 78.4}],
            "existing_government_scheme_benefits": ["Micro-Irrigation Subsidy"],
        },
        "farmer_category": "medium",
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


def seed_government_profiles() -> None:
    for profile in SYNTHETIC_PROFILES:
        aadhaar_number = profile["aadhaar_number"]
        profile_body = {k: v for k, v in profile.items() if k != "aadhaar_number"}
        doc = {
            **profile_body,
            "aadhaar_hash": aadhaar_hash(aadhaar_number),
            "source": "synthetic-government-database",
            "updated_at": datetime.now(timezone.utc),
        }
        government_profiles.update_one({"aadhaar_hash": doc["aadhaar_hash"]}, {"$set": doc}, upsert=True)
        for land in doc["land_records"]:
            land_records.update_one(
                {"land_id": land["land_id"]},
                {"$set": {
                    **land,
                    "farmer_aadhaar_hash": doc["aadhaar_hash"],
                    "cadastral_land_ha": land["land_area_ha"],
                    "soil_type": land["soil_type"],
                    "parcel_polygon": land["polygon"],
                }},
                upsert=True,
            )
    print(f"Upserted {len(SYNTHETIC_PROFILES)} synthetic Aadhaar-linked government profiles.")


if __name__ == "__main__":
    ensure_indexes()
    seed_schemes()
    seed_government_profiles()
    seed_admin()
    print("Seed complete.")
