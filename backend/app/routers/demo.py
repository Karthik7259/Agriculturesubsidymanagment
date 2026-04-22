"""Demo endpoints — proxy to the mock cadastral + bank services.

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

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import settings
from ..security import get_current_active_user, require_admin


log = logging.getLogger(__name__)

router = APIRouter()


def _land_base() -> str:
    return settings.land_records_api.rsplit("/parcels", 1)[0] or settings.land_records_api


def _land_auth() -> dict:
    return {"Authorization": f"Bearer {settings.land_records_token}"}


def _bank_base() -> str:
    return settings.bank_api_url.rsplit("/payouts", 1)[0]


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
            timeout=15.0,
        )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        log.warning("demo parcels fetch failed: %s", exc)
        raise HTTPException(502, "Cadastral registry unreachable")


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
        r = httpx.get(f"{_bank_base()}/ledger", params={"limit": limit}, timeout=15.0)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        log.warning("ledger fetch failed: %s", exc)
        raise HTTPException(502, "Bank ledger unreachable")


@router.get("/admin/accounts/{farmer_id}")
def admin_account(farmer_id: str, _: dict = Depends(require_admin)):
    try:
        r = httpx.get(f"{_bank_base()}/accounts/{farmer_id}", timeout=15.0)
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
        r = httpx.get(f"{_bank_base()}/transactions/{farmer_id}", params={"limit": limit}, timeout=15.0)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as exc:
        log.warning("txn fetch failed: %s", exc)
        raise HTTPException(502, "Bank unreachable")
