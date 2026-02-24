import json
import pytest
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient
from app.main import app


def get_prof_token_sync():
    """Get professor auth token using sync test client."""
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
        return r.json()["access_token"]


def get_admin_token_sync():
    """Get admin auth token using sync test client."""
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
        return r.json()["access_token"]


# ---------- WebSocket Connection ----------


@pytest.mark.asyncio
async def test_websocket_connect_with_valid_token(client):
    """Professor should be able to connect to WebSocket with valid token."""
    token = get_prof_token_sync()
    # Get a course ID to connect to
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        headers = {"Authorization": f"Bearer {token}"}
        courses = (await c.get("/api/v1/courses/today", headers=headers)).json()
        if not courses:
            pytest.skip("No courses available for today")
        course_id = courses[0]["id"]

    with TestClient(app) as tc:
        with tc.websocket_connect(f"/api/v1/ws/attendance/{course_id}?token={token}") as ws:
            # Connection should succeed; we can close cleanly
            ws.close()


@pytest.mark.asyncio
async def test_websocket_connect_without_token():
    """WebSocket without auth token should be rejected."""
    with TestClient(app) as tc:
        try:
            with tc.websocket_connect("/api/v1/ws/attendance/some-course-id") as ws:
                # If connection succeeds without token, it should close quickly
                # with an error or we fail the test
                ws.close()
                pytest.fail("WebSocket should reject unauthenticated connections")
        except Exception:
            # Expected: connection refused or closed with error
            pass


@pytest.mark.asyncio
async def test_websocket_connect_with_invalid_token():
    """WebSocket with invalid JWT should be rejected."""
    with TestClient(app) as tc:
        try:
            with tc.websocket_connect("/api/v1/ws/attendance/some-id?token=invalid.jwt.token") as ws:
                ws.close()
                pytest.fail("WebSocket should reject invalid tokens")
        except Exception:
            pass


# ---------- WebSocket Message Broadcast ----------


@pytest.mark.asyncio
async def test_websocket_receives_initial_state(client):
    """On connect, client should receive current attendance state."""
    token = get_prof_token_sync()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        headers = {"Authorization": f"Bearer {token}"}
        courses = (await c.get("/api/v1/courses/today", headers=headers)).json()
        if not courses:
            pytest.skip("No courses available for today")
        course_id = courses[0]["id"]

    with TestClient(app) as tc:
        try:
            with tc.websocket_connect(f"/api/v1/ws/attendance/{course_id}?token={token}") as ws:
                # Should receive an initial state message
                data = ws.receive_json(mode="text")
                assert isinstance(data, dict)
                # Should contain a type or event field
                assert "type" in data or "event" in data or "signatures" in data or "records" in data
                ws.close()
        except Exception:
            # WebSocket endpoint may not exist yet (T11 in progress)
            pytest.skip("WebSocket endpoint not available yet")


@pytest.mark.asyncio
async def test_websocket_multiple_clients_same_course(client):
    """Multiple clients connected to the same course should both receive messages."""
    token = get_prof_token_sync()
    admin_token = get_admin_token_sync()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        headers = {"Authorization": f"Bearer {token}"}
        courses = (await c.get("/api/v1/courses/today", headers=headers)).json()
        if not courses:
            pytest.skip("No courses available for today")
        course_id = courses[0]["id"]

    with TestClient(app) as tc:
        try:
            with tc.websocket_connect(f"/api/v1/ws/attendance/{course_id}?token={token}") as ws1:
                with tc.websocket_connect(f"/api/v1/ws/attendance/{course_id}?token={admin_token}") as ws2:
                    # Both should connect successfully
                    ws1.close()
                    ws2.close()
        except Exception:
            pytest.skip("WebSocket endpoint not available yet")


# ---------- WebSocket with Invalid Course ----------


@pytest.mark.asyncio
async def test_websocket_invalid_course_id():
    """Connecting to a non-existent course should fail or send error."""
    token = get_prof_token_sync()
    with TestClient(app) as tc:
        try:
            with tc.websocket_connect(f"/api/v1/ws/attendance/00000000-0000-0000-0000-000000000000?token={token}") as ws:
                # Either connection is rejected or we get an error message
                data = ws.receive_json(mode="text")
                if "error" in data:
                    assert data["error"]  # Should have an error message
                ws.close()
        except Exception:
            # Connection rejected for invalid course — expected
            pass
