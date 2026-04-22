from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from ..db import applications, farmers, schemes
from ..models import ApplicationCreate
from ..security import get_current_active_user
from ..services import audit
from ..utils.ids import gen_application_id


router = APIRouter()


@router.post("/", status_code=202)
def submit(body: ApplicationCreate, user: dict = Depends(get_current_active_user)):
    farmer = farmers.find_one({"farmer_id": user["sub"]})
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    scheme = schemes.find_one({"scheme_id": body.scheme_id})
    if not scheme:
        raise HTTPException(404, "Scheme not found")

    recent_dupes = applications.count_documents({
        "farmer_id": user["sub"],
        "scheme_id": body.scheme_id,
        "status": {"$nin": ["REJECTED", "DBT_FAILED", "WITHDRAWN"]},
    })
    if recent_dupes > 0:
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
        "annual_income": body.annual_income,
        "status": "SUBMITTED",
        "fraud_flags": [],
        "created_at": now,
        "updated_at": now,
    }
    applications.insert_one(doc)
    audit.log(app_id, None, "SUBMITTED", "api", {"scheme_id": body.scheme_id})

    try:
        from ..workers.celery_app import celery as _celery
        _celery.send_task("app.workers.tasks.verify_application", args=[app_id])
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "Celery dispatch failed — running verify_application inline for dev"
        )
        from ..workers.tasks import verify_application
        verify_application(app_id)

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
