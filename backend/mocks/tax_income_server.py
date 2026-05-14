"""Mock tax-income server for college-project demonstrations.

Endpoints:
    GET /health
    GET /income/by-aadhaar/{aadhaar_hash}

Authentication: Bearer <TAX_API_TOKEN>
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException

from mocks.db import ensure_indexes, parcels, tax_income_profiles


app = FastAPI(title="Mock Tax Income API", version="1.0.0")
TOKEN = os.getenv("TAX_API_TOKEN", "dev-tax-token")


def _auth(authorization: str) -> None:
    if not authorization.startswith("Bearer ") or authorization.split(" ", 1)[1] != TOKEN:
        raise HTTPException(401, "Unauthorized")


@app.on_event("startup")
def _startup() -> None:
    ensure_indexes()
    if tax_income_profiles.count_documents({}) > 0:
        return

    # Seed mock tax income from cadastral holdings when available.
    for p in parcels.find({}, {"owner_aadhaar_hash": 1, "total_hectares": 1}).limit(500):
        aadhaar = p.get("owner_aadhaar_hash")
        if not aadhaar:
            continue
        hectares = float(p.get("total_hectares") or 0)
        annual_income = round(hectares * 190000.0, 2)
        tax_income_profiles.update_one(
            {"aadhaar_hash": aadhaar},
            {
                "$set": {
                    "aadhaar_hash": aadhaar,
                    "annual_income": annual_income,
                    "assessment_year": "2025-26",
                    "updated_at": datetime.now(timezone.utc),
                    "record_id": f"TAX-{aadhaar[-8:].upper()}",
                }
            },
            upsert=True,
        )


@app.get("/health")
def health():
    return {"status": "ok", "profiles": tax_income_profiles.count_documents({})}


@app.get("/income/by-aadhaar/{aadhaar_hash}")
def by_aadhaar(aadhaar_hash: str, authorization: str = Header(default="")):
    _auth(authorization)
    doc = tax_income_profiles.find_one({"aadhaar_hash": aadhaar_hash}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Income profile not found")
    return doc
