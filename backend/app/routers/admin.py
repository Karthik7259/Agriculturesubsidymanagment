from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import applications
from ..models import AdminOverride
from ..security import require_admin
from ..services import audit


router = APIRouter()


@router.get("/queue")
def queue(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=500),
    _: dict = Depends(require_admin),
):
    query = {"status": status} if status else {}
    cursor = applications.find(query).sort("created_at", -1).limit(limit)
    out = []
    for a in cursor:
        a["_id"] = str(a["_id"])
        out.append(a)
    return out


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
    applications.update_one(
        {"application_id": application_id},
        {"$set": {
            "status": body.decision,
            "admin_note": body.note,
            "admin_id": admin_user["sub"],
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    audit.log(
        application_id=application_id,
        from_state=old_status,
        to_state=body.decision,
        triggered_by=f"admin:{admin_user['sub']}",
        payload={"note": body.note},
        note=body.note,
    )

    if body.decision == "APPROVED":
        try:
            from ..workers.celery_app import celery as _celery
            _celery.send_task("app.workers.tasks.execute_dbt_task", args=[application_id])
        except Exception:
            from ..services.dbt import execute_dbt
            execute_dbt(application_id)

    return {"status": body.decision}


@router.get("/analytics/summary")
def analytics(_: dict = Depends(require_admin)):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    counts = {row["_id"]: row["count"] for row in applications.aggregate(pipeline)}
    total = sum(counts.values())
    approved = counts.get("APPROVED", 0) + counts.get("DISBURSED", 0)
    return {
        "total": total,
        "by_status": counts,
        "approval_rate": (approved / total) if total else 0.0,
        "flagged": counts.get("FLAGGED", 0),
    }
