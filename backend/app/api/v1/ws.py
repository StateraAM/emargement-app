from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt
from app.core.config import settings
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/attendance/{course_id}")
async def attendance_ws(
    websocket: WebSocket,
    course_id: str,
    token: str = Query(...),
):
    # Validate professor token
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("user_type", "professor") != "professor":
            await websocket.close(code=4003, reason="Not a professor token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await ws_manager.connect(websocket, course_id)
    try:
        while True:
            # Keep connection alive; client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, course_id)
