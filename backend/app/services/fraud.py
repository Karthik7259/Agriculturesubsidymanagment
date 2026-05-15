"""Rule-based fraud flags + Isolation Forest anomaly detection."""

from __future__ import annotations

import logging
import os
from typing import Any

import joblib
import numpy as np

from ..config import settings
from ..db import applications
from . import crop_data


log = logging.getLogger(__name__)

HIGH_VIGOR = {"wheat", "rice", "sugarcane", "maize", "cotton"}


_iso = None


def _load_iso():
    global _iso
    if _iso is not None:
        return _iso
    if os.path.exists(settings.isoforest_path):
        try:
            _iso = joblib.load(settings.isoforest_path)
        except Exception as exc:
            log.warning("Isolation Forest load failed: %s", exc)
            _iso = None
    return _iso


def rule_flags(features: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    declared = float(features.get("declared_land_ha", 0) or 0)
    verified = float(features.get("verified_land_ha", 0) or 0)
    cadastral = float(features.get("cadastral_land_ha", 0) or 0)
    mean_ndvi = float(features.get("mean_ndvi", 0) or 0)
    crop = str(features.get("crop_type", "")).lower()

    if declared > 0 and verified < 0.7 * declared:
        flags.append("HIGH_OVERCLAIM")

    if mean_ndvi < 0.15 and crop in HIGH_VIGOR:
        flags.append("NON_CROPPED_LAND")

    if cadastral > 0 and declared > 1.10 * cadastral:
        flags.append("CADASTRAL_MISMATCH")

    if cadastral == 0:
        flags.append("CADASTRAL_UNVERIFIED")

    return flags


def duplicate_parcel_flag(application_id: str, polygon: dict) -> list[str]:
    """Near-duplicate detection on the GeoJSON polygon dict."""
    cnt = applications.count_documents(
        {"parcel_polygon": polygon, "application_id": {"$ne": application_id}}
    )
    return ["DUPLICATE_PARCEL"] if cnt > 0 else []


def market_flags(
    state: str,
    district: str,
    crop: str,
    estimated_production: float | None = None,
    declared_land_ha: float = 0,
) -> tuple[list[str], dict[str, Any]]:
    """Check crop against live mandi data. Returns (flags, price_context)."""
    flags: list[str] = []
    context: dict[str, Any] = {}

    if not settings.data_gov_api_key or not state or not crop:
        return flags, context

    benchmark = crop_data.get_crop_price_benchmark(state, district, crop)
    context["mandi_benchmark"] = benchmark

    if not benchmark.get("available"):
        records = crop_data.fetch_mandi_prices(state, commodity=crop)
        if not records:
            flags.append("NO_MANDI_ACTIVITY")
        else:
            context["state_level_records"] = len(records)

    if (
        estimated_production
        and estimated_production > 0
        and benchmark.get("available")
        and benchmark.get("avg_modal_price", 0) > 0
        and declared_land_ha > 0
    ):
        value_per_ha = (estimated_production * benchmark["avg_modal_price"]) / declared_land_ha
        context["estimated_value_per_ha"] = round(value_per_ha, 2)
        if value_per_ha > 500_000:
            flags.append("UNREALISTIC_PRODUCTION_VALUE")

    return flags, context


def anomaly(row: list[float]) -> list[str]:
    iso = _load_iso()
    if iso is None:
        return []
    try:
        pred = iso.predict(np.array([row]))
        return ["ANOMALY"] if int(pred[0]) == -1 else []
    except Exception as exc:
        log.warning("Isolation Forest predict failed: %s", exc)
        return []
