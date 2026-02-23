import pytest


async def get_admin_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_admin_stats(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/admin/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_students" in data
    assert "total_courses_today" in data
    assert "global_attendance_rate" in data


@pytest.mark.asyncio
async def test_admin_students_list(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/admin/students", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_non_admin_rejected(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    response = await client.get("/api/v1/admin/stats", headers=headers)
    assert response.status_code == 403
