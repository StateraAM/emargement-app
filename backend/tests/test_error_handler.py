import pytest
import uuid


@pytest.mark.asyncio
async def test_404_structured_response(client):
    """Explicitly raised 404 should return structured JSON error."""
    # Use a non-existent signature token to trigger an explicit HTTPException(404)
    fake_token = str(uuid.uuid4())
    r = await client.get(f"/api/v1/signatures/info/{fake_token}")
    assert r.status_code == 404
    data = r.json()
    assert data.get("error") is True
    assert data.get("status_code") == 404
    assert "request_id" in data


@pytest.mark.asyncio
async def test_validation_error_structured(client):
    """Invalid request body should return structured 422 error."""
    # POST to login without required fields
    r = await client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    data = r.json()
    assert data.get("error") is True
    assert data.get("status_code") == 422
    assert "request_id" in data


@pytest.mark.asyncio
async def test_health_check_returns_db_status(client):
    """Health endpoint should include database status."""
    r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "database" in data
    assert data["status"] in ("ok", "degraded")
