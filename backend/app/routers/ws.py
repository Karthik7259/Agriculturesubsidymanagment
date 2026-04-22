"""WebSocket endpoint for live application status updates.

Clients connect to /api/ws/applications/{application_id} and receive JSON
messages on every state change (emitted by the audit logger via Redis pub/sub).
"""

from __future__ import annotations

import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import settings
from ..services.events import channel_for


log = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/applications/{application_id}")
async def ws_application(websocket: WebSocket, application_id: str):
    await websocket.accept()
    client = aioredis.from_url(settings.celery_backend, decode_responses=False)
    pubsub = client.pubsub()
    channel = channel_for(application_id)
    await pubsub.subscribe(channel)

    await websocket.send_json({"type": "subscribed", "application_id": application_id})

    try:
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            data = msg.get("data")
            if isinstance(data, bytes):
                data = data.decode("utf-8", errors="replace")
            try:
                await websocket.send_text(data)
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning("WS error on %s: %s", application_id, exc)
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await client.close()
        except Exception:
            pass
