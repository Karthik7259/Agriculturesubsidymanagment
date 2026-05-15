"""Endpoints for data.gov.in crop & agriculture data lookups."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..services import crop_data

router = APIRouter()


@router.get("/mandi-prices")
def mandi_prices(
    state: str = Query(..., description="State name"),
    district: str | None = Query(None, description="District name"),
    commodity: str | None = Query(None, description="Commodity/crop name"),
):
    records = crop_data.fetch_mandi_prices(state, district, commodity)
    return {"count": len(records), "records": records}


@router.get("/market-prices")
def market_prices(
    state: str = Query(..., description="State name"),
    district: str | None = Query(None, description="District name"),
    commodity: str | None = Query(None, description="Commodity/crop name"),
):
    records = crop_data.fetch_market_prices(state, district, commodity)
    return {"count": len(records), "records": records}


@router.get("/benchmark")
def price_benchmark(
    state: str = Query(..., description="State name"),
    district: str = Query(..., description="District name"),
    commodity: str = Query(..., description="Commodity/crop name"),
):
    return crop_data.get_crop_price_benchmark(state, district, commodity)
