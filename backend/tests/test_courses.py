import pytest


async def get_auth_header(client, email="jean.dupont@ecole.fr", password="password123"):
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_today_courses(client):
    headers = await get_auth_header(client)
    response = await client.get("/api/v1/courses/today", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "name" in data[0]
    assert "room" in data[0]
    assert "student_count" in data[0]


@pytest.mark.asyncio
async def test_get_course_students(client):
    headers = await get_auth_header(client)
    courses = (await client.get("/api/v1/courses/today", headers=headers)).json()
    course_id = courses[0]["id"]
    response = await client.get(f"/api/v1/courses/{course_id}/students", headers=headers)
    assert response.status_code == 200
    students = response.json()
    assert isinstance(students, list)
    assert len(students) > 0
    assert "first_name" in students[0]
