import pytest


async def get_auth_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_validate_attendance(client):
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    students = (await client.get(f"/api/v1/courses/{course_id}/students", headers=headers)).json()

    entries = [
        {"student_id": students[0]["id"], "status": "present"},
        {"student_id": students[1]["id"], "status": "absent"},
        {"student_id": students[2]["id"], "status": "present"},
    ]
    response = await client.post("/api/v1/attendance/validate", headers=headers, json={
        "course_id": course_id, "entries": entries,
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    # Present students should have signature tokens
    assert data[0]["status"] == "present"
    assert data[1]["status"] == "absent"
