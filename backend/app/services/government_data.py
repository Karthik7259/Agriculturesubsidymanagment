from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..db import government_profiles
from .income import aadhaar_hash


def _farmer_category(total_hectares: float) -> str:
    if total_hectares < 1:
        return "marginal"
    if total_hectares < 2:
        return "small"
    if total_hectares < 4:
        return "medium"
    return "large"


def serialize_profile(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    out = dict(doc)
    out.pop("_id", None)
    return out


def build_fallback_profile(aadhaar_number: str, full_name: str | None = None) -> dict[str, Any]:
    return build_fallback_profile_from_hash(aadhaar_hash(aadhaar_number), full_name)


def build_fallback_profile_from_hash(aadhaar: str, full_name: str | None = None) -> dict[str, Any]:
    name = full_name or "Demo Farmer"
    land = {
        "land_id": f"LND-{aadhaar[-8:].upper()}",
        "survey_number": "101/A",
        "ownership_details": "Self owned",
        "land_area_ha": 1.25,
        "soil_type": "black cotton",
        "irrigation_availability": "borewell",
        "village": "Wagholi",
        "taluk": "Haveli",
        "district": "Pune",
        "state": "Maharashtra",
        "polygon": {
            "type": "Polygon",
            "coordinates": [[[73.8567, 18.5204], [73.8581, 18.5204], [73.8581, 18.5216], [73.8567, 18.5216], [73.8567, 18.5204]]],
        },
    }
    return {
        "aadhaar_hash": aadhaar,
        "personal": {
            "full_name": name,
            "age": 42,
            "gender": "Male",
            "address": "Demo village, Pune, Maharashtra",
            "contact_details": {"mobile": ""},
        },
        "land_records": [land],
        "financial": {
            "annual_income": 185000,
            "subsidy_history": [],
            "loan_details": [],
            "insurance_details": [],
        },
        "agriculture": {
            "previously_cultivated_crops": ["wheat", "pulses"],
            "crop_history": [{"season": "rabi-2025", "crop": "wheat", "yield_t_per_ha": 3.2}],
            "yield_records": [{"crop": "wheat", "year": 2025, "yield_t_per_ha": 3.2}],
            "existing_government_scheme_benefits": [],
        },
        "farmer_category": _farmer_category(land["land_area_ha"]),
        "linked_at": datetime.now(timezone.utc),
        "source": "synthetic-government-database",
    }


def fetch_or_create_profile(aadhaar_number: str, full_name: str | None = None) -> dict[str, Any]:
    aadhaar = aadhaar_hash(aadhaar_number)
    return fetch_or_create_profile_by_hash(aadhaar, full_name)


def fetch_or_create_profile_by_hash(aadhaar: str, full_name: str | None = None) -> dict[str, Any]:
    existing = government_profiles.find_one({"aadhaar_hash": aadhaar})
    if existing:
        return existing
    profile = build_fallback_profile_from_hash(aadhaar, full_name)
    government_profiles.insert_one(profile)
    return profile


def primary_land(profile: dict[str, Any]) -> dict[str, Any]:
    records = profile.get("land_records") or []
    return records[0] if records else {}
