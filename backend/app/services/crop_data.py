"""data.gov.in Open Government Data client for crop & agriculture datasets.

Fetches daily mandi prices and market price history to cross-check
farmer crop claims and provide market context during verification.

Register at https://data.gov.in (email only) to get an API key.
Set DATA_GOV_API_KEY in .env.
"""

from __future__ import annotations

import json
import logging
import subprocess
from typing import Any
from urllib.parse import urlencode

from ..config import settings

log = logging.getLogger(__name__)

BASE_URL = "https://api.data.gov.in/resource"

# Current daily mandi prices (state, district, market, commodity, min/max/modal price)
MANDI_PRICE_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"
# Variety-wise daily market prices (broader historical coverage)
MARKET_PRICE_RESOURCE = "35985678-0d79-46b4-9ed6-6f13308a1d24"


def _get(resource_id: str, filters: dict[str, str], limit: int = 10) -> list[dict[str, Any]]:
    if not settings.data_gov_api_key:
        log.debug("data.gov.in: no API key configured, skipping")
        return []

    params: dict[str, str] = {
        "api-key": settings.data_gov_api_key,
        "format": "json",
        "limit": str(limit),
    }
    for k, v in filters.items():
        params[f"filters[{k}]"] = v

    url = f"{BASE_URL}/{resource_id}?{urlencode(params)}"

    try:
        result = subprocess.run(
            ["curl", "-s", "-m", "30", url],
            capture_output=True, text=True, timeout=35,
        )
        if result.returncode != 0:
            log.warning("data.gov.in curl failed: %s", result.stderr)
            return []
        body = json.loads(result.stdout)
        return body.get("records", [])
    except subprocess.TimeoutExpired:
        log.warning("data.gov.in request timed out")
        return []
    except (json.JSONDecodeError, Exception) as exc:
        log.warning("data.gov.in unexpected error: %s", exc)
        return []


def fetch_mandi_prices(
    state: str,
    district: str | None = None,
    commodity: str | None = None,
) -> list[dict[str, Any]]:
    """Current daily mandi prices for a state/district/commodity."""
    filters: dict[str, str] = {"state": state}
    if district:
        filters["district"] = district
    if commodity:
        filters["commodity"] = commodity
    return _get(MANDI_PRICE_RESOURCE, filters, limit=20)


def fetch_market_prices(
    state: str,
    district: str | None = None,
    commodity: str | None = None,
) -> list[dict[str, Any]]:
    """Variety-wise daily market prices (historical)."""
    filters: dict[str, str] = {"state": state}
    if district:
        filters["district"] = district
    if commodity:
        filters["commodity"] = commodity
    return _get(MARKET_PRICE_RESOURCE, filters, limit=20)


def get_crop_price_benchmark(
    state: str,
    district: str,
    commodity: str,
) -> dict[str, Any]:
    """Return current price stats for a commodity in the district.

    Used during verification to provide market context for the farmer's crop.
    """
    records = fetch_mandi_prices(state, district, commodity)
    if not records:
        records = fetch_mandi_prices(state, commodity=commodity)
    if not records:
        return {"available": False}

    modal_prices = []
    min_prices = []
    max_prices = []
    markets = set()
    for r in records:
        try:
            modal = float(r.get("modal_price") or 0)
            lo = float(r.get("min_price") or 0)
            hi = float(r.get("max_price") or 0)
            market = r.get("market") or ""
            if modal > 0:
                modal_prices.append(modal)
            if lo > 0:
                min_prices.append(lo)
            if hi > 0:
                max_prices.append(hi)
            if market:
                markets.add(market)
        except (ValueError, TypeError):
            continue

    if not modal_prices:
        return {"available": False, "records_found": len(records)}

    return {
        "available": True,
        "district": district,
        "state": state,
        "commodity": commodity,
        "avg_modal_price": round(sum(modal_prices) / len(modal_prices), 2),
        "min_price": round(min(min_prices), 2) if min_prices else None,
        "max_price": round(max(max_prices), 2) if max_prices else None,
        "markets_count": len(markets),
        "sample_size": len(modal_prices),
    }


def enrich_application(
    district: str,
    state: str,
    crop: str,
) -> dict[str, Any]:
    """Aggregate data.gov.in enrichments for a verification run."""
    result: dict[str, Any] = {"data_gov_enriched": False}

    if not settings.data_gov_api_key:
        return result

    benchmark = get_crop_price_benchmark(state, district, crop)
    market_history = fetch_market_prices(state, district, crop)

    result["data_gov_enriched"] = benchmark.get("available", False) or bool(market_history)
    if benchmark.get("available"):
        result["mandi_price_benchmark"] = benchmark
    if market_history:
        result["market_price_history"] = {
            "records": len(market_history),
            "sample": market_history[0] if market_history else None,
        }

    return result
