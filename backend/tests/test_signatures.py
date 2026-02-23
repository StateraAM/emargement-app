import pytest


async def get_auth_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_get_signature_page(client):
    # Use the second course to avoid conflicts with test_attendance
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[1]["id"]
    students = (await client.get(f"/api/v1/courses/{course_id}/students", headers=headers)).json()

    await client.post("/api/v1/attendance/validate", headers=headers, json={
        "course_id": course_id,
        "entries": [{"student_id": students[0]["id"], "status": "present"}],
    })

    # Test with invalid token returns 404
    response = await client.get("/api/v1/signatures/info/invalid-token")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_sign_with_expired_token(client):
    response = await client.post("/api/v1/signatures/sign/invalid-token")
    assert response.status_code == 404
