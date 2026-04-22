"""Redis pub/sub event bus.

Producers: `publish(application_id, event_dict)` from the Celery worker,
the audit logger, and the applications router.

Consumers: the FastAPI WebSocket endpoint in `routers/ws.py` subscribes per
application_id and streams events to the browser.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache

import redis

from ..config import settings


log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _redis() -> redis.Redis:
    return redis.from_url(settings.celery_backend, decode_responses=False)


def channel_for(application_id: str) -> str:
    return f"app:{application_id}"


def publish(application_id: str, event: dict) -> None:
    try:
        _redis().publish(channel_for(application_id), json.dumps(event, default=str))
    except Exception as exc:
        log.warning("Event publish failed for %s: %s", application_id, exc)
