"""Cadastral / land-records client.

Posts the farmer's parcel polygon to the land-records service, which returns
the matching registered parcel (if any) with full ownership + crop history.

Return shape:
    {
        "hectares": float | None,
        "parcel": dict | None,   # full cadastral record incl. history
        "match_kind": str | None,  # "geo_intersect" | "proximity" | None
        "flags": list[str],        # e.g. ["CADASTRAL_UNVERIFIED"]
    }
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import settings


log = logging.getLogger(__name__)


def lookup_by_polygon(
    polygon: dict,
    farmer_aadhaar_hash: str | None = None,
) -> dict[str, Any]:
    """Match the polygon against the cadastral registry and return the full record."""
    try:
        r = httpx.post(
            f"{settings.land_records_api}/match",
            json={"polygon": polygon, "owner_aadhaar_hash": farmer_aadhaar_hash},
            headers={"Authorization": f"Bearer {settings.land_records_token}"},
            timeout=20.0,
        )
        r.raise_for_status()
        data = r.json()
    except httpx.HTTPError as exc:
        log.error("Cadastral match failed: %s", exc)
        return {"hectares": None, "parcel": None, "match_kind": None, "flags": ["CADASTRAL_API_ERROR"]}

    if not data.get("matched"):
        return {"hectares": None, "parcel": None, "match_kind": None, "flags": ["CADASTRAL_UNVERIFIED"]}

    parcel = data["parcel"]
    hectares = float(parcel.get("total_hectares", 0) or 0)
    flags: list[str] = []

    disputes = parcel.get("disputes") or []
    if any(d.get("status") != "resolved" for d in disputes):
        flags.append("CADASTRAL_DISPUTE_OPEN")

    if parcel.get("classification") not in ("agricultural", "horticultural"):
        flags.append("LAND_NOT_AGRICULTURAL")

    return {
        "hectares": hectares,
        "parcel": parcel,
        "match_kind": data.get("match_kind"),
        "flags": flags,
    }


def fetch_for(farmer_id: str, declared_ha: float | None = None) -> float | None:
    """Legacy helper — now unused by the worker; kept so any tests importing it still pass."""
    return declared_ha
