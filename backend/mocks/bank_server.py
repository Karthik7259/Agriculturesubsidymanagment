"""Mock bank payout + ledger server — Mongo-backed with realistic behavior.

Models a simplified NPCI-style DBT transfer API:
 - HMAC-verifies signed payouts.
 - Persists each transaction (idempotent by app_id → idempotency_key).
 - Auto-provisions an account for first-time farmer_ids (simulating Aadhaar-
   linked banking) with a random bank + IFSC.
 - KYC + frozen-account gating.
 - Tunable failure modes (random NPCI timeouts, name mismatch, insufficient-
   funds) for demo realism.

Endpoints:
    POST /payouts                       — signed DBT call (used by backend)
    GET  /accounts/{farmer_id}         — masked account details
    GET  /transactions/{farmer_id}     — transaction history
    GET  /ledger                        — ops-level view of all txns (admin demo)
    GET  /health
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import random
import secrets
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException, Query, Request
from pymongo import DESCENDING

from mocks.db import bank_accounts, bank_txns, ensure_indexes


log = logging.getLogger(__name__)

app = FastAPI(title="Mock Bank Payout API", version="2.0.0")

HMAC_KEY = os.getenv("BANK_HMAC_KEY", "dev-bank-hmac-key").encode()

FAILURE_RATE_NPCI_TIMEOUT = float(os.getenv("BANK_FAIL_RATE_NPCI", "0.02"))
FAILURE_RATE_KYC = float(os.getenv("BANK_FAIL_RATE_KYC", "0.01"))


BANKS = [
    ("State Bank of India", "SBIN"),
    ("Bank of Maharashtra",  "MAHB"),
    ("HDFC Bank",           "HDFC"),
    ("ICICI Bank",          "ICIC"),
    ("Punjab National Bank", "PUNB"),
]


@app.on_event("startup")
def _startup() -> None:
    ensure_indexes()


def _sign(body: dict) -> str:
    canon = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hmac.new(HMAC_KEY, canon, hashlib.sha256).hexdigest()


def _account_hash(seed: str) -> str:
    return "sha256:" + hashlib.sha256(f"ACCOUNT-{seed}".encode()).hexdigest()[:16]


def _ensure_account(farmer_id: str) -> dict:
    doc = bank_accounts.find_one({"farmer_id": farmer_id})
    if doc:
        return doc
    rng = random.Random(farmer_id)
    bank_name, ifsc_prefix = rng.choice(BANKS)
    account_no = str(rng.randint(10**10, 10**11 - 1))
    doc = {
        "farmer_id": farmer_id,
        "account_number_hash": _account_hash(account_no),
        "account_number_masked": f"XXXX{account_no[-4:]}",
        "bank_name": bank_name,
        "ifsc": f"{ifsc_prefix}0{rng.randint(100000, 999999)}",
        "name_on_account": None,
        "kyc_status": "VERIFIED",
        "balance": 0.0,
        "frozen": False,
        "created_at": datetime.now(timezone.utc),
    }
    bank_accounts.insert_one(doc)
    log.info("Auto-provisioned bank account for %s", farmer_id)
    return doc


def _serialize_acc(doc: dict) -> dict:
    out = dict(doc)
    out.pop("_id", None)
    if "created_at" in out and hasattr(out["created_at"], "isoformat"):
        out["created_at"] = out["created_at"].isoformat()
    return out


def _serialize_txn(doc: dict) -> dict:
    out = dict(doc)
    out.pop("_id", None)
    for k in ("created_at", "completed_at"):
        if k in out and hasattr(out[k], "isoformat"):
            out[k] = out[k].isoformat()
    return out


@app.get("/health")
def health():
    return {
        "status": "ok",
        "accounts": bank_accounts.count_documents({}),
        "transactions": bank_txns.count_documents({}),
    }


@app.post("/payouts")
async def payouts(request: Request, x_signature: str = Header(default="")):
    body = await request.json()
    expected = _sign(body)
    if not hmac.compare_digest(expected, x_signature):
        raise HTTPException(401, "Invalid signature")

    farmer_id = body.get("farmer_id")
    amount = float(body.get("amount") or 0)
    app_id = body.get("app_id")
    idempotency_key = body.get("idempotency_key") or app_id

    if not farmer_id or amount <= 0:
        raise HTTPException(400, "Missing farmer_id or amount")

    if idempotency_key:
        prev = bank_txns.find_one({"idempotency_key": idempotency_key})
        if prev:
            return {
                "txn_id": prev["txn_id"],
                "status": prev["status"],
                "amount": prev["amount"],
                "replay": True,
            }

    account = _ensure_account(farmer_id)

    if account.get("frozen"):
        txn = _record_txn(farmer_id, app_id, amount, idempotency_key, status="FAILED", error="ACCOUNT_FROZEN", account=account)
        raise HTTPException(422, {"txn_id": txn["txn_id"], "status": "FAILED", "error": "ACCOUNT_FROZEN"})

    if account.get("kyc_status") != "VERIFIED":
        txn = _record_txn(farmer_id, app_id, amount, idempotency_key, status="FAILED", error="KYC_NOT_VERIFIED", account=account)
        raise HTTPException(422, {"txn_id": txn["txn_id"], "status": "FAILED", "error": "KYC_NOT_VERIFIED"})

    rng = random.Random()

    force = request.query_params.get("fail")
    if force == "1" or rng.random() < FAILURE_RATE_NPCI_TIMEOUT:
        txn = _record_txn(farmer_id, app_id, amount, idempotency_key, status="FAILED", error="NPCI_TIMEOUT", account=account)
        raise HTTPException(504, {"txn_id": txn["txn_id"], "status": "FAILED", "error": "NPCI_TIMEOUT"})

    if rng.random() < FAILURE_RATE_KYC:
        txn = _record_txn(farmer_id, app_id, amount, idempotency_key, status="FAILED", error="NAME_MISMATCH", account=account)
        raise HTTPException(422, {"txn_id": txn["txn_id"], "status": "FAILED", "error": "NAME_MISMATCH"})

    new_balance = float(account.get("balance", 0)) + amount
    bank_accounts.update_one({"farmer_id": farmer_id}, {"$set": {"balance": new_balance}})
    txn = _record_txn(farmer_id, app_id, amount, idempotency_key, status="SUCCESS", account=account, new_balance=new_balance)

    return {
        "txn_id": txn["txn_id"],
        "amount": amount,
        "status": "SUCCESS",
        "bank_name": account["bank_name"],
        "ifsc": account["ifsc"],
        "account_masked": account["account_number_masked"],
        "balance_after": new_balance,
        "npci_ref": txn.get("npci_ref"),
    }


def _record_txn(farmer_id, app_id, amount, idempotency_key, status, account, error=None, new_balance=None):
    now = datetime.now(timezone.utc)
    txn = {
        "txn_id": f"TXN-{secrets.token_hex(4).upper()}",
        "idempotency_key": idempotency_key,
        "farmer_id": farmer_id,
        "application_id": app_id,
        "amount": amount,
        "direction": "CREDIT",
        "status": status,
        "error": error,
        "bank_name": account.get("bank_name"),
        "ifsc": account.get("ifsc"),
        "account_masked": account.get("account_number_masked"),
        "balance_after": new_balance,
        "npci_ref": f"NPCI-{secrets.token_hex(5).upper()}" if status == "SUCCESS" else None,
        "created_at": now,
        "completed_at": now,
    }
    bank_txns.insert_one(txn)
    return txn


@app.get("/accounts/{farmer_id}")
def get_account(farmer_id: str):
    doc = bank_accounts.find_one({"farmer_id": farmer_id})
    if not doc:
        raise HTTPException(404, "Account not found")
    return _serialize_acc(doc)


@app.get("/transactions/{farmer_id}")
def farmer_txns(farmer_id: str, limit: int = Query(default=50, le=200)):
    cursor = bank_txns.find({"farmer_id": farmer_id}).sort("created_at", DESCENDING).limit(limit)
    return [_serialize_txn(t) for t in cursor]


@app.get("/ledger")
def full_ledger(limit: int = Query(default=200, le=1000)):
    cursor = bank_txns.find({}).sort("created_at", DESCENDING).limit(limit)
    return [_serialize_txn(t) for t in cursor]
