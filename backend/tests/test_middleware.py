import uuid
import pytest


@pytest.mark.asyncio
async def test_request_id_header_present(client):
    """All responses should have X-Request-ID header."""
    r = await client.get("/health")
    assert r.status_code == 200
    assert "x-request-id" in r.headers
    # Should be a UUID-like string
    request_id = r.headers["x-request-id"]
    assert len(request_id) == 36  # UUID format


@pytest.mark.asyncio
async def test_request_id_unique(client):
    """Each request should get a unique request ID."""
    r1 = await client.get("/health")
    r2 = await client.get("/health")
    id1 = r1.headers.get("x-request-id")
    id2 = r2.headers.get("x-request-id")
    assert id1 != id2


@pytest.mark.asyncio
async def test_request_id_in_error_response(client):
    """Error responses should include request_id in body matching the header."""
    # Use an endpoint that raises an explicit HTTPException so the custom
    # error handler includes request_id in the JSON body.
    fake_token = str(uuid.uuid4())
    r = await client.get(f"/api/v1/signatures/info/{fake_token}")
    assert r.status_code == 404
    data = r.json()
    request_id_header = r.headers.get("x-request-id")
    request_id_body = data.get("request_id")
    # Both should be present and match
    assert request_id_header is not None
    assert request_id_body is not None
    assert request_id_header == request_id_body
