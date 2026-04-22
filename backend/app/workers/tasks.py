"""Verification orchestrator + DBT task.

SUBMITTED → VERIFYING → (APPROVED | REJECTED | FLAGGED) → DISBURSED | DBT_FAILED

Each substep publishes a Redis event so the WebSocket endpoint can push live
progress to the browser.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from .celery_app import celery
from ..db import applications, farmers
from ..services import audit, cadastral, dbt, events, fraud, ml, satellite


log = logging.getLogger(__name__)


APPROVAL_THRESHOLD = 0.6


def _decide(prob: float, flags: list[str]) -> str:
    if flags:
        return "FLAGGED"
    return "APPROVED" if prob >= APPROVAL_THRESHOLD else "REJECTED"


def _progress(app_id: str, step: str, detail: dict | None = None) -> None:
    events.publish(app_id, {"type": "progress", "application_id": app_id, "step": step, **(detail or {})})


def _run_verify(application_id: str) -> dict:
    guard = applications.find_one_and_update(
        {"application_id": application_id, "status": "SUBMITTED"},
        {"$set": {"status": "VERIFYING", "updated_at": datetime.now(timezone.utc)}},
    )
    if not guard:
        log.info("verify_application: app %s not in SUBMITTED, skipping", application_id)
        return {"skipped": True}
    audit.log(application_id, "SUBMITTED", "VERIFYING", "orchestrator", payload={})

    app = applications.find_one({"application_id": application_id})
    assert app is not None
    farmer = farmers.find_one({"farmer_id": app["farmer_id"]}) or {}

    _progress(application_id, "ndvi_fetch_start")
    ndvi = satellite.compute_ndvi(app["parcel_polygon"], app.get("declared_land_ha"))
    preview_url = satellite.persist_tile_record(application_id, ndvi)
    _progress(application_id, "ndvi_fetch_done", {
        "hectares": ndvi["hectares"],
        "mean_ndvi": ndvi["mean_ndvi"],
        "preview_url": preview_url,
    })

    _progress(application_id, "cadastral_fetch_start")
    cadastral_result = cadastral.lookup_by_polygon(app["parcel_polygon"])
    cadastral_ha = cadastral_result["hectares"]
    cadastral_parcel = cadastral_result["parcel"]
    cadastral_flags_from_registry = cadastral_result["flags"]
    _progress(application_id, "cadastral_fetch_done", {
        "cadastral_ha": cadastral_ha,
        "parcel_id": (cadastral_parcel or {}).get("parcel_id"),
        "match_kind": cadastral_result.get("match_kind"),
    })

    last_crop = None
    ownership_years = None
    if cadastral_parcel:
        ch = cadastral_parcel.get("crop_history") or []
        last_crop = (ch[0] or {}).get("crop") if ch else None
        since = cadastral_parcel.get("ownership_since")
        if since:
            try:
                y = int(str(since)[:4])
                ownership_years = datetime.now(timezone.utc).year - y
            except Exception:
                ownership_years = None

    features = {
        "declared_land_ha": app["declared_land_ha"],
        "verified_land_ha": ndvi["hectares"],
        "cadastral_land_ha": cadastral_ha or 0.0,
        "mean_ndvi": ndvi["mean_ndvi"],
        "annual_income": app["annual_income"],
        "crop_type": app["crop_type"],
    }
    row = ml.to_row(features)

    _progress(application_id, "ml_inference_start")
    try:
        prob, explanation = ml.predict_and_explain(row)
    except Exception as exc:
        log.error("ML inference failed: %s", exc)
        prob, explanation = 0.0, f"Model unavailable: {exc}"
    _progress(application_id, "ml_inference_done", {"prob": prob, "explanation": explanation})

    flags = fraud.rule_flags(features)
    flags += fraud.duplicate_parcel_flag(application_id, app["parcel_polygon"])
    flags += fraud.anomaly(row)
    flags += cadastral_flags_from_registry

    if last_crop and app["crop_type"].lower() != str(last_crop).lower() and cadastral_parcel:
        ch = cadastral_parcel.get("crop_history") or []
        seen = {str(c.get("crop", "")).lower() for c in ch}
        if app["crop_type"].lower() not in seen:
            flags.append("CROP_HISTORY_MISMATCH")

    flags = list(dict.fromkeys(flags))

    decision = _decide(prob, flags)

    applications.update_one(
        {"application_id": application_id},
        {"$set": {
            "verified_land_ha": ndvi["hectares"],
            "cadastral_land_ha": cadastral_ha,
            "cadastral_parcel": cadastral_parcel,
            "cadastral_match_kind": cadastral_result.get("match_kind"),
            "mean_ndvi": ndvi["mean_ndvi"],
            "ndvi_tile_id": ndvi["tile_id"],
            "ndvi_cloud_cover": ndvi["cloud_cover"],
            "ndvi_preview_url": preview_url,
            "eligibility_prob": prob,
            "shap_explanation": explanation,
            "fraud_flags": flags,
            "status": decision,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    audit.log(
        application_id=application_id,
        from_state="VERIFYING",
        to_state=decision,
        triggered_by="ml-inference",
        payload={
            "prob": prob,
            "flags": flags,
            "features": features,
            "parcel_id": (cadastral_parcel or {}).get("parcel_id"),
        },
    )

    if decision == "APPROVED":
        try:
            celery.send_task("app.workers.tasks.execute_dbt_task", args=[application_id])
        except Exception:
            log.exception("DBT dispatch failed — running inline")
            dbt.execute_dbt(application_id)

    return {"status": decision, "prob": prob, "flags": flags}


@celery.task(name="app.workers.tasks.verify_application")
def verify_application(application_id: str) -> dict:
    return _run_verify(application_id)


@celery.task(name="app.workers.tasks.execute_dbt_task", bind=True, max_retries=3)
def execute_dbt_task(self, application_id: str) -> dict:
    try:
        return dbt.execute_dbt(application_id)
    except Exception as exc:
        log.exception("DBT task failed, retrying")
        raise self.retry(exc=exc, countdown=60)
