"""Mock state land-records server — Mongo-backed, with realistic cadastral data.

Endpoints:
    GET  /parcels                       list (paginated)
    GET  /parcels/{parcel_id}           parcel by ID
    POST /parcels/match                 match by polygon (+ optional aadhaar)
    GET  /parcels/by-aadhaar/{hash}     every parcel owned by one owner
    GET  /health

Authentication: Bearer <LAND_RECORDS_TOKEN>.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel

from mocks.db import bank_accounts, ensure_indexes, parcels


log = logging.getLogger(__name__)

app = FastAPI(title="Mock Land Records API", version="2.0.0")
TOKEN = os.getenv("LAND_RECORDS_TOKEN", "dev-land-token")


@app.on_event("startup")
def _startup() -> None:
    ensure_indexes()
    if parcels.count_documents({}) == 0:
        log.info("Empty cadastral registry detected — auto-seeding demo data…")
        try:
            from mocks.seed_demo import seed_parcels, seed_bank_accounts
            np = seed_parcels()
            na = seed_bank_accounts()
            log.info("Auto-seeded %d parcels and %d bank accounts", np, na)
        except Exception as exc:
            log.error("Auto-seed failed: %s", exc)


def _auth(authorization: str) -> None:
    if not authorization.startswith("Bearer ") or authorization.split(" ", 1)[1] != TOKEN:
        raise HTTPException(401, "Unauthorized")


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    if "updated_at" in doc:
        doc["updated_at"] = doc["updated_at"].isoformat() if hasattr(doc["updated_at"], "isoformat") else str(doc["updated_at"])
    return doc


@app.get("/health")
def health():
    return {"status": "ok", "parcels": parcels.count_documents({})}


@app.get("/parcels")
def list_parcels(
    state: str | None = Query(default=None),
    district: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    authorization: str = Header(default=""),
):
    _auth(authorization)
    q: dict[str, Any] = {}
    if state:
        q["state"] = state
    if district:
        q["district"] = district
    cursor = parcels.find(q).limit(limit)
    return [_serialize(p) for p in cursor]


@app.get("/parcels/{parcel_id}")
def get_parcel(parcel_id: str, authorization: str = Header(default="")):
    _auth(authorization)
    doc = parcels.find_one({"parcel_id": parcel_id})
    if not doc:
        raise HTTPException(404, "Parcel not found")
    return _serialize(doc)


@app.get("/parcels/by-aadhaar/{aadhaar_hash}")
def by_aadhaar(aadhaar_hash: str, authorization: str = Header(default="")):
    _auth(authorization)
    cursor = parcels.find({"owner_aadhaar_hash": aadhaar_hash})
    return [_serialize(p) for p in cursor]


class MatchRequest(BaseModel):
    polygon: dict
    owner_aadhaar_hash: str | None = None


@app.post("/parcels/match")
def match_polygon(req: MatchRequest, authorization: str = Header(default="")):
    """Return the cadastral parcel (if any) intersecting the given GeoJSON polygon.

    Falls back to a nearest-centroid match if the polygon doesn't intersect a
    registered parcel — helpful for demo polygons drawn slightly off the seeded
    coordinates.
    """
    _auth(authorization)

    try:
        intersects = list(parcels.find(
            {"polygon": {"$geoIntersects": {"$geometry": req.polygon}}}
        ).limit(5))
    except Exception as exc:
        log.warning("geoIntersects failed: %s", exc)
        intersects = []

    if intersects:
        best = intersects[0]
        return {
            "matched": True,
            "match_kind": "geo_intersect",
            "match_count": len(intersects),
            "parcel": _serialize(best),
            "other_candidates": [_serialize(p) for p in intersects[1:]],
        }

    try:
        near = list(parcels.find({
            "polygon": {
                "$near": {
                    "$geometry": req.polygon.get("coordinates", [[[0, 0]]])[0][0] and {
                        "type": "Point",
                        "coordinates": req.polygon["coordinates"][0][0],
                    },
                    "$maxDistance": 2000,
                }
            }
        }).limit(1))
    except Exception:
        near = []

    if near:
        return {
            "matched": True,
            "match_kind": "proximity",
            "match_count": 1,
            "parcel": _serialize(near[0]),
            "other_candidates": [],
        }

    return {"matched": False, "match_kind": None, "match_count": 0, "parcel": None, "other_candidates": []}
