import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_external_login(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "parent123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_external_me(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_type"] == "external"
    assert data["first_name"] == "Pierre"
    assert data["last_name"] == "Martin"


@pytest.mark.asyncio
async def test_external_dashboard(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/external/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "student" in data
    assert "stats" in data
    assert "history" in data
    assert data["student"]["first_name"] == "Alice"
    assert data["student"]["last_name"] == "Martin"


@pytest.mark.asyncio
async def test_external_reports(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/external/reports", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_external_cannot_access_admin(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_external_cannot_access_student(client: AsyncClient):
    login = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "parent123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/student/attendance-history", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_external_wrong_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "parent.martin@email.fr",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401
