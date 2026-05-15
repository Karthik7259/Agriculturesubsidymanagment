"""In-process event bus (no Redis required).

Producers call `publish(application_id, event_dict)` from the worker/tasks.
Consumers (WebSocket endpoint) call `subscribe(application_id)` to get an
asyncio.Queue that receives events in real time.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict

log = logging.getLogger(__name__)

_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


def channel_for(application_id: str) -> str:
    return f"app:{application_id}"


def publish(application_id: str, event: dict) -> None:
    queues = _subscribers.get(application_id, [])
    data = json.dumps(event, default=str)
    for q in queues:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            log.warning("Event queue full for %s, dropping event", application_id)


def subscribe(application_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers[application_id].append(q)
    return q


def unsubscribe(application_id: str, q: asyncio.Queue) -> None:
    try:
        _subscribers[application_id].remove(q)
    except ValueError:
        pass
    if not _subscribers[application_id]:
        del _subscribers[application_id]
