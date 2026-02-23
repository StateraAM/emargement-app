import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_justifications_requires_admin(client: AsyncClient):
    """Non-admin prof should get 403"""
    login = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_justifications_as_admin(client: AsyncClient):
    """Admin should see justifications list"""
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1  # At least the seeded justification


@pytest.mark.asyncio
async def test_list_justifications_filter_by_status(client: AsyncClient):
    """Filter should only return matching status"""
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications?status=pending", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    for j in resp.json():
        assert j["status"] == "pending"


@pytest.mark.asyncio
async def test_review_justification_approve(client: AsyncClient):
    """Admin can approve a pending justification"""
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    # Get a pending justification
    resp = await client.get("/api/v1/admin/justifications?status=pending", headers={"Authorization": f"Bearer {token}"})
    pending = resp.json()
    assert len(pending) > 0
    jid = pending[0]["id"]
    resp = await client.put(
        f"/api/v1/admin/justifications/{jid}/review",
        json={"decision": "approved"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_review_justification_already_reviewed(client: AsyncClient):
    """Re-reviewing should return 400"""
    login = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/justifications?status=approved", headers={"Authorization": f"Bearer {token}"})
    approved = resp.json()
    if len(approved) > 0:
        jid = approved[0]["id"]
        resp = await client.put(
            f"/api/v1/admin/justifications/{jid}/review",
            json={"decision": "rejected"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
