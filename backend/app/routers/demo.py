"""Demo endpoints — proxy to the mock cadastral + bank services.

Falls back to local MongoDB collections when the external Docker services
(land-mock, bank-mock) are unreachable.

Public (authenticated) endpoints:
  GET /api/demo/parcels              — all registered demo parcels (for the wizard)

Admin-only endpoints:
  GET /api/demo/admin/parcels        — same, but richer response for admin UI
  GET /api/demo/admin/ledger         — global bank ledger
  GET /api/demo/admin/accounts/{fid} — masked bank account for a farmer
  GET /api/demo/admin/transactions/{fid}
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..db import applications, land_records, farmers
from ..security import get_current_active_user, require_admin


log = logging.getLogger(__name__)

router = APIRouter()


def _land_base() -> str:
    return settings.land_records_api.rsplit("/parcels", 1)[0] or settings.land_records_api


def _land_auth() -> dict:
    return {"Authorization": f"Bearer {settings.land_records_token}"}


def _bank_base() -> str:
    return settings.bank_api_url.rsplit("/payouts", 1)[0]


def _polygon_centroid(polygon: dict | None) -> dict | None:
    if not polygon:
        return None
    try:
        ring = polygon["coordinates"][0]
        points = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
        if not points:
            return None
        lng = sum(float(point[0]) for point in points) / len(points)
        lat = sum(float(point[1]) for point in points) / len(points)
        return {"lat": lat, "lng": lng}
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None


def _location_label(parcel: dict[str, Any]) -> str:
    parts = [
        parcel.get("village"),
        parcel.get("taluka") or parcel.get("taluk"),
        parcel.get("district"),
        parcel.get("state"),
    ]
    return ", ".join(str(part) for part in parts if part)


def _normalize_parcel(rec: dict[str, Any], source: str) -> dict:
    polygon = rec.get("parcel_polygon") or rec.get("polygon")
    parcel = {
        "parcel_id": rec.get("parcel_id") or rec.get("land_id") or "LND-UNKNOWN",
        "state": rec.get("state", ""),
        "district": rec.get("district", ""),
        "taluka": rec.get("taluka") or rec.get("taluk", ""),
        "polygon": polygon,
        "total_hectares": float(rec.get("total_hectares") or rec.get("land_area_ha") or rec.get("cadastral_land_ha") or 0),
        "owner_name": rec.get("owner_name", "Registered Owner"),
        "soil_type": rec.get("soil_type", ""),
        "irrigation_source": rec.get("irrigation_source") or rec.get("irrigation_availability", ""),
        "survey_number": rec.get("survey_number") or rec.get("survey_no", ""),
        "ownership_details": rec.get("ownership_details", ""),
        "village": rec.get("village", ""),
        "source": source,
    }
    parcel["centroid"] = _polygon_centroid(polygon)
    parcel["location_label"] = _location_label(parcel)
    return parcel


def _parcels_from_db(state: str | None = None, district: str | None = None) -> list[dict]:
    """Build parcel list from local MongoDB land_records collection."""
    query: dict = {}
    if state:
        query["state"] = state
    if district:
        query["district"] = district

    parcels = []
    for rec in land_records.find(query):
        polygon = rec.get("parcel_polygon") or rec.get("polygon")
        if not polygon:
            continue

        farmer = None
        aadhaar_hash = rec.get("farmer_aadhaar_hash")
        if aadhaar_hash:
            from ..db import government_profiles
            profile = government_profiles.find_one({"aadhaar_hash": aadhaar_hash})
            if profile and profile.get("personal"):
                farmer = profile["personal"].get("full_name")

        rec = dict(rec)
        if farmer:
            rec["owner_name"] = farmer
        parcels.append(_normalize_parcel(rec, "local_db"))
    return parcels


def _ledger_from_db(limit: int = 200) -> list[dict]:
    """Build bank ledger from application documents that have DBT data."""
    cursor = applications.find(
        {"dbt_status": {"$exists": True, "$ne": None}},
    ).sort("updated_at", -1).limit(limit)

    txns = []
    for app in cursor:
        scheme_id = app.get("scheme_id", "")
        farmer_id = app.get("farmer_id", "")

        # Look up farmer name
        farmer = farmers.find_one({"farmer_id": farmer_id}, {"full_name": 1})
        farmer_name = farmer.get("full_name", farmer_id) if farmer else farmer_id

        txns.append({
            "txn_id": app.get("dbt_txn_id") or f"TXN-{app.get('application_id', '')[:8]}",
            "farmer_id": farmer_id,
            "farmer_name": farmer_name,
            "application_id": app.get("application_id", ""),
            "scheme_id": scheme_id,
            "amount": app.get("dbt_amount", 0),
            "status": app.get("dbt_status", "UNKNOWN"),
            "error": app.get("dbt_error"),
            "bank_name": app.get("dbt_bank_name", ""),
            "ifsc": app.get("dbt_ifsc", ""),
            "account_masked": app.get("dbt_account_masked", ""),
            "npci_ref": app.get("dbt_npci_ref", ""),
            "balance_after": app.get("dbt_balance_after"),
            "created_at": (
                app.get("updated_at", app.get("created_at", "")).isoformat()
                if hasattr(app.get("updated_at", app.get("created_at", "")), "isoformat")
                else str(app.get("updated_at", app.get("created_at", "")))
            ),
            "source": "local_db",
        })
    return txns


@router.get("/parcels")
def list_demo_parcels(
    state: str | None = Query(default=None),
    district: str | None = Query(default=None),
    _: dict = Depends(get_current_active_user),
):
    try:
        r = httpx.get(
            f"{_land_base()}/parcels",
            params={k: v for k, v in {"state": state, "district": district}.items() if v},
            headers=_land_auth(),
            timeout=8.0,
        )
        r.raise_for_status()
        return [_normalize_parcel(parcel, "land_registry") for parcel in r.json() if parcel.get("polygon")]
    except httpx.HTTPError as exc:
        log.warning("demo parcels: land-mock unreachable (%s) — using local DB", exc)
        fallback = _parcels_from_db(state, district)
        if fallback:
            return fallback
        raise HTTPException(502, "Cadastral registry unreachable and no local records found")


@router.get("/admin/parcels")
def admin_parcels(
    state: str | None = Query(default=None),
    district: str | None = Query(default=None),
    _: dict = Depends(require_admin),
):
    return list_demo_parcels(state=state, district=district, _=_)


@router.get("/admin/ledger")
def admin_ledger(limit: int = Query(default=200, le=1000), _: dict = Depends(require_admin)):
    try:
        r = httpx.get(f"{_bank_base()}/ledger", params={"limit": limit}, timeout=8.0)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        log.warning("ledger: bank-mock unreachable (%s) — using local DB", exc)
        fallback = _ledger_from_db(limit)
        return fallback


@router.get("/admin/accounts/{farmer_id}")
def admin_account(farmer_id: str, _: dict = Depends(require_admin)):
    try:
        r = httpx.get(f"{_bank_base()}/accounts/{farmer_id}", timeout=8.0)
        if r.status_code == 404:
            raise HTTPException(404, "No bank account")
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        log.warning("account fetch failed: %s", exc)
        raise HTTPException(502, "Bank unreachable")


@router.get("/admin/transactions/{farmer_id}")
def admin_transactions(
    farmer_id: str,
    limit: int = Query(default=50, le=200),
    _: dict = Depends(require_admin),
):
    try:
        r = httpx.get(f"{_bank_base()}/transactions/{farmer_id}", params={"limit": limit}, timeout=8.0)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        log.warning("txn fetch failed: %s", exc)
        raise HTTPException(502, "Bank unreachable")
