from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import applications, farmers
from ..models import AdminOverride
from ..security import require_admin
from ..services import audit, events


router = APIRouter()

ALL_STATUSES = [
    "SUBMITTED", "VERIFYING", "APPROVED", "REJECTED",
    "FLAGGED", "DISBURSED", "DBT_FAILED", "INFO_REQUESTED", "UNDER_REVIEW",
]


def _enrich_row(a: dict) -> dict:
    """Attach farmer display name to an application document."""
    a["_id"] = str(a["_id"])
    farmer = farmers.find_one({"farmer_id": a.get("farmer_id")}, {"full_name": 1, "state": 1, "district": 1, "phone": 1})
    if farmer:
        a["farmer_name"] = farmer.get("full_name", a.get("farmer_id"))
        a["farmer_state"] = farmer.get("state", "")
        a["farmer_district"] = farmer.get("district", "")
        a["farmer_phone"] = farmer.get("phone", "")
    else:
        a["farmer_name"] = a.get("farmer_id", "Unknown")
    return a


@router.get("/queue")
def queue(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=500),
    _: dict = Depends(require_admin),
):
    query = {"status": status} if status else {}
    cursor = applications.find(query).sort("created_at", -1).limit(limit)
    return [_enrich_row(a) for a in cursor]


@router.get("/audit/{application_id}")
def get_audit(application_id: str, _: dict = Depends(require_admin)):
    trail = audit.get_trail(application_id)
    if not trail:
        raise HTTPException(404, "No audit trail found")
    return trail


@router.patch("/applications/{application_id}")
def override(
    application_id: str,
    body: AdminOverride,
    admin_user: dict = Depends(require_admin),
):
    a = applications.find_one({"application_id": application_id})
    if not a:
        raise HTTPException(404, "Application not found")

    old_status = a.get("status")

    update_fields: dict = {
        "status": body.decision,
        "admin_note": body.note,
        "admin_id": admin_user["sub"],
        "admin_decision_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if body.priority:
        update_fields["priority"] = body.priority

    # Clear fraud flags when admin explicitly clears the application
    if body.clear_flags:
        update_fields["fraud_flags"] = []

    applications.update_one(
        {"application_id": application_id},
        {"$set": update_fields},
    )

    audit.log(
        application_id=application_id,
        from_state=old_status,
        to_state=body.decision,
        triggered_by=f"admin:{admin_user['sub']}",
        payload={"note": body.note, "priority": body.priority},
        note=body.note,
    )

    # Publish WebSocket event so farmer sees the change live
    try:
        events.publish(application_id, {
            "type": "state_change",
            "application_id": application_id,
            "status": body.decision,
            "note": body.note,
        })
    except Exception:
        pass

    # If approved, trigger DBT
    if body.decision == "APPROVED":
        try:
            from ..workers.celery_app import celery as _celery
            _celery.send_task("app.workers.tasks.execute_dbt_task", args=[application_id])
        except Exception:
            from ..services.dbt import execute_dbt
            execute_dbt(application_id)

    # If forced DISBURSED, update DBT status fields too
    if body.decision == "DISBURSED":
        applications.update_one(
            {"application_id": application_id},
            {"$set": {"dbt_status": "ADMIN_OVERRIDE", "dbt_txn_id": f"ADM-{application_id[:8].upper()}"}},
        )

    return {"status": body.decision, "old_status": old_status}


@router.post("/applications/{application_id}/reverify")
def reverify(
    application_id: str,
    admin_user: dict = Depends(require_admin),
):
    """Reset application to SUBMITTED and re-dispatch the verification pipeline."""
    a = applications.find_one({"application_id": application_id})
    if not a:
        raise HTTPException(404, "Application not found")

    old_status = a.get("status")
    applications.update_one(
        {"application_id": application_id},
        {"$set": {
            "status": "SUBMITTED",
            "fraud_flags": [],
            "eligibility_prob": None,
            "shap_explanation": None,
            "verified_land_ha": None,
            "cadastral_land_ha": None,
            "cadastral_parcel": None,
            "mean_ndvi": None,
            "admin_note": f"Re-verification triggered by admin:{admin_user['sub']}",
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    audit.log(
        application_id=application_id,
        from_state=old_status,
        to_state="SUBMITTED",
        triggered_by=f"admin:{admin_user['sub']}",
        payload={"action": "reverify"},
        note="Admin-triggered re-verification",
    )

    try:
        from ..workers.celery_app import celery as _celery
        _celery.send_task("app.workers.tasks.verify_application", args=[application_id])
        dispatched = True
    except Exception:
        dispatched = False

    return {"status": "SUBMITTED", "dispatched": dispatched, "old_status": old_status}


@router.post("/applications/{application_id}/clear-flags")
def clear_flags(
    application_id: str,
    admin_user: dict = Depends(require_admin),
):
    """Clear fraud flags and promote FLAGGED → APPROVED."""
    a = applications.find_one({"application_id": application_id})
    if not a:
        raise HTTPException(404, "Application not found")

    old_status = a.get("status")
    new_status = "APPROVED" if old_status in ("FLAGGED", "UNDER_REVIEW") else old_status
    applications.update_one(
        {"application_id": application_id},
        {"$set": {
            "fraud_flags": [],
            "status": new_status,
            "admin_note": f"Flags cleared by admin:{admin_user['sub']}",
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    audit.log(
        application_id=application_id,
        from_state=old_status,
        to_state=new_status,
        triggered_by=f"admin:{admin_user['sub']}",
        payload={"action": "clear_flags"},
        note="Fraud flags cleared — admin review passed",
    )

    if new_status == "APPROVED":
        try:
            from ..workers.celery_app import celery as _celery
            _celery.send_task("app.workers.tasks.execute_dbt_task", args=[application_id])
        except Exception:
            from ..services.dbt import execute_dbt
            execute_dbt(application_id)

    return {"status": new_status, "flags_cleared": True}


@router.get("/analytics/summary")
def analytics(_: dict = Depends(require_admin)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    counts = {row["_id"]: row["count"] for row in applications.aggregate(pipeline)}
    total = sum(counts.values())
    approved = counts.get("APPROVED", 0) + counts.get("DISBURSED", 0)

    # By crop type
    crop_pipeline = [{"$group": {"_id": "$crop_type", "count": {"$sum": 1}}}]
    by_crop = {row["_id"]: row["count"] for row in applications.aggregate(crop_pipeline) if row["_id"]}

    # By scheme
    scheme_pipeline = [
        {"$group": {"_id": "$scheme_id", "count": {"$sum": 1}, "approved": {
            "$sum": {"$cond": [{"$in": ["$status", ["APPROVED", "DISBURSED"]]}, 1, 0]}
        }}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    by_scheme = [
        {"scheme_id": row["_id"], "count": row["count"], "approved": row["approved"]}
        for row in applications.aggregate(scheme_pipeline)
    ]

    # By state
    state_pipeline = [
        {"$lookup": {
            "from": "farmers",
            "localField": "farmer_id",
            "foreignField": "farmer_id",
            "as": "farmer_info",
        }},
        {"$unwind": {"path": "$farmer_info", "preserveNullAndEmptyArrays": True}},
        {"$group": {"_id": "$farmer_info.state", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]
    by_state = {row["_id"]: row["count"] for row in applications.aggregate(state_pipeline) if row["_id"]}

    # Average eligibility probability for decided applications
    prob_pipeline = [
        {"$match": {"eligibility_prob": {"$ne": None}}},
        {"$group": {"_id": None, "avg_prob": {"$avg": "$eligibility_prob"}}},
    ]
    prob_result = list(applications.aggregate(prob_pipeline))
    avg_prob = prob_result[0]["avg_prob"] if prob_result else 0.0

    # Applications with fraud flags
    flagged_detail_pipeline = [
        {"$match": {"fraud_flags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$fraud_flags"},
        {"$group": {"_id": "$fraud_flags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    flag_frequency = {row["_id"]: row["count"] for row in applications.aggregate(flagged_detail_pipeline)}

    # Recent 10 applications
    recent_cursor = applications.find({}).sort("created_at", -1).limit(10)
    recent = []
    for a in recent_cursor:
        farmer = farmers.find_one({"farmer_id": a.get("farmer_id")}, {"full_name": 1})
        recent.append({
            "application_id": a["application_id"],
            "farmer_name": farmer.get("full_name", a.get("farmer_id", "Unknown")) if farmer else a.get("farmer_id", "Unknown"),
            "scheme_id": a.get("scheme_id", ""),
            "crop_type": a.get("crop_type", ""),
            "status": a.get("status", ""),
            "created_at": a.get("created_at", "").isoformat() if hasattr(a.get("created_at", ""), "isoformat") else str(a.get("created_at", "")),
            "eligibility_prob": a.get("eligibility_prob"),
        })

    return {
        "total": total,
        "by_status": counts,
        "approval_rate": (approved / total) if total else 0.0,
        "flagged": counts.get("FLAGGED", 0),
        "disbursed": counts.get("DISBURSED", 0),
        "avg_eligibility_prob": avg_prob,
        "by_crop": by_crop,
        "by_scheme": by_scheme,
        "by_state": by_state,
        "flag_frequency": flag_frequency,
        "recent": recent,
    }


@router.get("/farmers")
def list_farmers(
    limit: int = Query(default=50, le=200),
    _: dict = Depends(require_admin),
):
    """List all registered farmers for the admin panel."""
    cursor = farmers.find({"role": {"$ne": "admin"}}).sort("created_at", -1).limit(limit)
    out = []
    for f in cursor:
        f["_id"] = str(f["_id"])
        f.pop("hashed_password", None)
        app_count = applications.count_documents({"farmer_id": f.get("farmer_id")})
        f["application_count"] = app_count
        out.append(f)
    return out
