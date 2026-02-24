from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, course_id: str):
        await websocket.accept()
        self._rooms.setdefault(course_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, course_id: str):
        conns = self._rooms.get(course_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._rooms.pop(course_id, None)

    async def broadcast(self, course_id: str, message: dict):
        for ws in list(self._rooms.get(course_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws, course_id)


ws_manager = ConnectionManager()
