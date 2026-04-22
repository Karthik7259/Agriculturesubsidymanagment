from datetime import datetime, timezone
from typing import Any, Optional

from ..db import audit_log
from ..utils.hashing import hash_payload
from . import events


def log(
    application_id: str,
    from_state: Optional[str],
    to_state: str,
    triggered_by: str,
    payload: Optional[dict[str, Any]] = None,
    note: Optional[str] = None,
) -> None:
    """Append an audit entry AND publish a Redis event for live WS listeners.

    Insert-only; no update/delete path exists.
    """
    now = datetime.now(timezone.utc)
    entry = {
        "application_id": application_id,
        "from_state": from_state,
        "to_state": to_state,
        "triggered_by": triggered_by,
        "timestamp": now,
        "payload_hash": hash_payload(payload) if payload is not None else None,
    }
    if note:
        entry["note"] = note
    audit_log.insert_one(entry)

    events.publish(
        application_id,
        {
            "type": "state_change",
            "application_id": application_id,
            "from_state": from_state,
            "to_state": to_state,
            "triggered_by": triggered_by,
            "timestamp": now.isoformat(),
            "note": note,
        },
    )


def get_trail(application_id: str) -> list[dict]:
    cursor = audit_log.find({"application_id": application_id}).sort("timestamp", 1)
    out = []
    for row in cursor:
        row["_id"] = str(row["_id"])
        out.append(row)
    return out
