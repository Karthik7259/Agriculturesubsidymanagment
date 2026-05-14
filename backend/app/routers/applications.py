from datetime import datetime, timezone
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ..db import applications, farmers, schemes
from ..config import settings
from ..models import ApplicationCreate
from ..security import get_current_active_user
from ..services import audit
from ..utils.ids import gen_application_id


router = APIRouter()
log = logging.getLogger(__name__)


def _run_inline_verification_logged(application_id: str) -> None:
    from ..workers.tasks import verify_application

    try:
        result = verify_application(application_id)
        log.info("Inline verification completed application_id=%s result=%s", application_id, result)
    except Exception:
        log.exception("Inline verification failed application_id=%s", application_id)


@router.post("/", status_code=202)
def submit(
    body: ApplicationCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_active_user),
):
    log.info(
        "Application submit requested farmer_id=%s scheme_id=%s declared_land_ha=%s crop_type=%s",
        user.get("sub"),
        body.scheme_id,
        body.declared_land_ha,
        body.crop_type,
    )

    farmer = farmers.find_one({"farmer_id": user["sub"]})
    if not farmer:
        log.warning("Application submit failed: farmer not found farmer_id=%s", user.get("sub"))
        raise HTTPException(404, "Farmer not found")

    scheme = schemes.find_one({"scheme_id": body.scheme_id})
    if not scheme:
        log.warning("Application submit failed: scheme not found scheme_id=%s", body.scheme_id)
        raise HTTPException(404, "Scheme not found")

    recent_dupes = applications.count_documents({
        "farmer_id": user["sub"],
        "scheme_id": body.scheme_id,
        "status": {"$nin": ["REJECTED", "DBT_FAILED", "WITHDRAWN"]},
    })
    if recent_dupes > 0:
        log.warning(
            "Application submit blocked: duplicate active application farmer_id=%s scheme_id=%s count=%s",
            user.get("sub"),
            body.scheme_id,
            recent_dupes,
        )
        raise HTTPException(409, "An active application for this scheme already exists")

    app_id = gen_application_id()
    now = datetime.now(timezone.utc)

    doc = {
        "application_id": app_id,
        "farmer_id": user["sub"],
        "farmer_state": farmer.get("state", ""),
        "scheme_id": body.scheme_id,
        "parcel_polygon": body.parcel_polygon.model_dump(),
        "declared_land_ha": body.declared_land_ha,
        "crop_type": body.crop_type.lower(),
        "crop_season": body.crop_season,
        "irrigation_method": body.irrigation_method,
        "fertilizer_usage": body.fertilizer_usage,
        "estimated_production": body.estimated_production,
        "annual_income": body.annual_income,
        "status": "SUBMITTED",
        "fraud_flags": [],
        "created_at": now,
        "updated_at": now,
    }
    applications.insert_one(doc)
    audit.log(app_id, None, "SUBMITTED", "api", {"scheme_id": body.scheme_id})
    log.info("Application created application_id=%s farmer_id=%s", app_id, user.get("sub"))

    if settings.inline_tasks:
        background_tasks.add_task(_run_inline_verification_logged, app_id)
        log.info("Inline verification queued in background application_id=%s", app_id)
        return {"application_id": app_id, "status": "SUBMITTED"}

    try:
        from ..workers.celery_app import celery as _celery
        _celery.send_task("app.workers.tasks.verify_application", args=[app_id])
        log.info("Celery verification dispatched application_id=%s", app_id)
    except Exception:
        log.exception("Celery dispatch failed; running verify_application inline application_id=%s", app_id)
        background_tasks.add_task(_run_inline_verification_logged, app_id)
        log.info("Fallback inline verification queued in background application_id=%s", app_id)

    return {"application_id": app_id, "status": "SUBMITTED"}


@router.get("/")
def my_applications(user: dict = Depends(get_current_active_user)):
    cursor = applications.find({"farmer_id": user["sub"]}).sort("created_at", -1)
    out = []
    for a in cursor:
        a["_id"] = str(a["_id"])
        out.append(a)
    return out


@router.get("/{application_id}")
def get_application(application_id: str, user: dict = Depends(get_current_active_user)):
    a = applications.find_one({"application_id": application_id})
    if not a:
        raise HTTPException(404, "Application not found")
    if user.get("role") != "admin" and a.get("farmer_id") != user["sub"]:
        raise HTTPException(403, "Not your application")
    a["_id"] = str(a["_id"])
    a["audit_trail"] = audit.get_trail(application_id)
    return a
