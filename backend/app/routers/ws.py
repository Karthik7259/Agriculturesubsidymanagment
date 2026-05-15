"""WebSocket endpoint for live application status updates (no Redis needed).

Uses in-process asyncio queues from the events service.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.events import subscribe, unsubscribe

log = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/applications/{application_id}")
async def ws_application(websocket: WebSocket, application_id: str):
    await websocket.accept()
    queue = subscribe(application_id)
    await websocket.send_json({"type": "subscribed", "application_id": application_id})

    try:
        while True:
            data = await queue.get()
            try:
                await websocket.send_text(data)
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning("WS error on %s: %s", application_id, exc)
    finally:
        unsubscribe(application_id, queue)
