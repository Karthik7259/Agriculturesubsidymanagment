from __future__ import annotations

from typing import Any

import httpx

from ..config import settings
from ..db import land_records
from ..utils.hashing import sha256_hex


INCOME_PER_HECTARE = 150000.0


def normalize_aadhaar(aadhaar_number: str) -> str:
    digits = "".join(c for c in aadhaar_number if c.isdigit())
    if len(digits) != 12:
        raise ValueError("aadhaar_number must contain exactly 12 digits")
    return digits


def aadhaar_hash(aadhaar_number: str) -> str:
    return f"sha256:{sha256_hex(normalize_aadhaar(aadhaar_number))}"


def estimate_income_from_hectares(hectares: float) -> float:
    return round(max(0.0, hectares) * INCOME_PER_HECTARE, 2)


def _income_payload(source: str, hectares: float, evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "annual_income": estimate_income_from_hectares(hectares),
        "income_source": source,
        "income_basis_hectares": round(max(0.0, hectares), 3),
        "income_evidence": evidence,
    }


def _tax_income_payload(amount: float, evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "annual_income": round(max(0.0, amount), 2),
        "income_source": "tax_api",
        "income_basis_hectares": None,
        "income_evidence": evidence,
    }


def derive_annual_income(
    *,
    aadhaar_number: str | None = None,
    land_id: str | None = None,
    consent_to_tax_fetch: bool = False,
) -> dict[str, Any]:
    """Derive an estimated income from a land record or Aadhaar-linked parcels.

    Preference order:
    1. Tax API by Aadhaar hash (only when user consent is true)
    2. Local `land_records` collection by `land_id`
    3. Land-records service by Aadhaar hash
    """

    attempts: list[dict[str, Any]] = []

    if consent_to_tax_fetch and aadhaar_number:
        aadhaar = aadhaar_hash(aadhaar_number)
        try:
            r = httpx.get(
                f"{settings.tax_api_url}/by-aadhaar/{aadhaar}",
                headers={"Authorization": f"Bearer {settings.tax_api_token}"},
                timeout=15.0,
            )
            r.raise_for_status()
            payload = r.json()
            amount = payload.get("annual_income")
            if amount is not None:
                out = _tax_income_payload(
                    float(amount),
                    {
                        "aadhaar_hash": aadhaar,
                        "record_id": payload.get("record_id"),
                        "assessment_year": payload.get("assessment_year"),
                        "source": "tax_api",
                    },
                )
                out["income_derivation_attempts"] = [
                    {"source": "tax_api", "status": "success"}
                ]
                return out
            attempts.append({"source": "tax_api", "status": "no_income"})
        except httpx.HTTPError as exc:
            attempts.append({"source": "tax_api", "status": "error", "reason": str(exc)[:140]})

    if land_id:
        doc = land_records.find_one({"land_id": land_id})
        if doc:
            hectares = float(doc.get("cadastral_land_ha") or doc.get("total_hectares") or 0)
            out = _income_payload(
                "land_record",
                hectares,
                {
                    "land_id": land_id,
                    "source": "mongo.land_records",
                },
            )
            out["income_derivation_attempts"] = attempts + [
                {"source": "land_record", "status": "success"}
            ]
            return out
        attempts.append({"source": "land_record", "status": "not_found", "land_id": land_id})

    if aadhaar_number:
        aadhaar = aadhaar_hash(aadhaar_number)
        try:
            r = httpx.get(
                f"{settings.land_records_api}/parcels/by-aadhaar/{aadhaar}",
                headers={"Authorization": f"Bearer {settings.land_records_token}"},
                timeout=15.0,
            )
            r.raise_for_status()
            parcels = r.json()
        except httpx.HTTPError as exc:
            attempts.append({"source": "aadhaar_land_registry", "status": "error", "reason": str(exc)[:140]})
            parcels = []

        if parcels:
            hectares = sum(float(p.get("total_hectares") or p.get("cadastral_land_ha") or 0) for p in parcels)
            out = _income_payload(
                "aadhaar_land_registry",
                hectares,
                {
                    "aadhaar_hash": aadhaar,
                    "parcel_count": len(parcels),
                    "parcel_ids": [p.get("parcel_id") for p in parcels],
                },
            )
            out["income_derivation_attempts"] = attempts + [
                {"source": "aadhaar_land_registry", "status": "success", "parcel_count": len(parcels)}
            ]
            return out
        attempts.append({"source": "aadhaar_land_registry", "status": "not_found"})

    return {
        "annual_income": None,
        "income_source": None,
        "income_basis_hectares": None,
        "income_evidence": None,
        "income_derivation_attempts": attempts,
    }