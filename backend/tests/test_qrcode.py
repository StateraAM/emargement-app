import pytest


async def get_auth_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_get_qr_code(client):
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    response = await client.get(f"/api/v1/attendance/{course_id}/qr", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
