"""Direct Benefit Transfer — HMAC-signed POST to the bank payout API.

The mock bank returns a richer response (bank_name, IFSC, masked account,
balance_after, npci_ref) which we persist on the application document so the
UI can render a convincing receipt.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx

from ..config import settings
from ..db import applications, schemes
from . import audit


log = logging.getLogger(__name__)


def _sign(body: dict) -> str:
    canon = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hmac.new(
        settings.bank_hmac_key.encode("utf-8"),
        canon,
        hashlib.sha256,
    ).hexdigest()


def execute_dbt(application_id: str) -> dict:
    app = applications.find_one({"application_id": application_id})
    if not app:
        raise ValueError(f"Application {application_id} not found")

    scheme = schemes.find_one({"scheme_id": app["scheme_id"]})
    if not scheme:
        raise ValueError(f"Scheme {app['scheme_id']} not found")

    body = {
        "app_id": application_id,
        "farmer_id": app["farmer_id"],
        "amount": scheme.get("benefit_amount", 0),
        "scheme_id": scheme["scheme_id"],
        "idempotency_key": application_id,
    }

    ok = False
    receipt: dict = {}
    err: str | None = None
    try:
        r = httpx.post(
            settings.bank_api_url,
            json=body,
            headers={"X-Signature": _sign(body)},
            timeout=20.0,
        )
        if r.status_code == 200:
            ok = True
            receipt = r.json() if r.content else {}
        else:
            try:
                detail = r.json().get("detail") if r.content else None
            except Exception:
                detail = r.text[:200]
            if isinstance(detail, dict):
                receipt = detail
                err = detail.get("error", f"HTTP_{r.status_code}")
            else:
                err = str(detail or f"HTTP_{r.status_code}")
    except httpx.HTTPError as exc:
        err = f"HTTP_ERROR: {exc}"
        log.error("DBT request failed: %s", exc)

    applications.update_one(
        {"application_id": application_id},
        {
            "$set": {
                "dbt_status": "SUCCESS" if ok else "FAILED",
                "dbt_txn_id": receipt.get("txn_id"),
                "dbt_bank_name": receipt.get("bank_name"),
                "dbt_ifsc": receipt.get("ifsc"),
                "dbt_account_masked": receipt.get("account_masked"),
                "dbt_npci_ref": receipt.get("npci_ref"),
                "dbt_balance_after": receipt.get("balance_after"),
                "dbt_error": err,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    audit.log(
        application_id=application_id,
        from_state="APPROVED",
        to_state="DISBURSED" if ok else "DBT_FAILED",
        triggered_by="dbt-worker",
        payload={
            "amount": body["amount"],
            "txn_id": receipt.get("txn_id"),
            "npci_ref": receipt.get("npci_ref"),
            "error": err,
        },
    )
    return {"ok": ok, "receipt": receipt, "error": err}
