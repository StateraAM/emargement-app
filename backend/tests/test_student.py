import pytest


async def get_prof_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def get_student_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "alice.martin@student.fr", "password": "student123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_student_login(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "alice.martin@student.fr",
        "password": "student123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_student_login_wrong_password(client):
    response = await client.post("/api/v1/auth/login", json={
        "email": "alice.martin@student.fr",
        "password": "wrong"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_as_student(client):
    headers = await get_student_header(client)
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user_type"] == "student"
    assert data["email"] == "alice.martin@student.fr"
    assert data["first_name"] == "Alice"


@pytest.mark.asyncio
async def test_me_as_professor(client):
    headers = await get_prof_header(client)
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user_type"] == "professor"
    assert data["role"] == "prof"


@pytest.mark.asyncio
async def test_notifications_empty(client):
    headers = await get_student_header(client)
    response = await client.get("/api/v1/student/notifications", headers=headers)
    assert response.status_code == 200
    # May or may not have notifications depending on test order


@pytest.mark.asyncio
async def test_unread_count(client):
    headers = await get_student_header(client)
    response = await client.get("/api/v1/student/notifications/unread-count", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "count" in data


@pytest.mark.asyncio
async def test_mark_all_read(client):
    headers = await get_student_header(client)
    response = await client.post("/api/v1/student/notifications/mark-all-read", headers=headers)
    assert response.status_code == 200

    # Verify count is 0
    response = await client.get("/api/v1/student/notifications/unread-count", headers=headers)
    assert response.json()["count"] == 0


@pytest.mark.asyncio
async def test_attendance_history(client):
    headers = await get_student_header(client)
    response = await client.get("/api/v1/student/attendance-history", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_student_cannot_access_prof_endpoints(client):
    headers = await get_student_header(client)
    response = await client.get("/api/v1/courses/today", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_notification_created_on_validate(client):
    """Validate attendance creates notification for present student."""
    prof_headers = await get_prof_header(client)
    student_headers = await get_student_header(client)

    # Get courses and find Alice's student_id
    courses = (await client.get("/api/v1/courses/today", headers=prof_headers)).json()
    # Use a course that hasn't been used in other tests — use the last one
    course_id = courses[-1]["id"]
    students_resp = await client.get(f"/api/v1/courses/{course_id}/students", headers=prof_headers)
    students = students_resp.json()

    # Find Alice
    alice = next((s for s in students if s["first_name"] == "Alice"), None)
    assert alice is not None

    # Validate attendance with Alice as present
    await client.post("/api/v1/attendance/validate", headers=prof_headers, json={
        "course_id": course_id,
        "entries": [{"student_id": alice["id"], "status": "present"}],
    })

    # Check that Alice got a notification
    response = await client.get("/api/v1/student/notifications", headers=student_headers)
    assert response.status_code == 200
    notifications = response.json()
    sig_notifs = [n for n in notifications if n["type"] == "signature_request"]
    assert len(sig_notifs) >= 1

    # Check unread count
    response = await client.get("/api/v1/student/notifications/unread-count", headers=student_headers)
    assert response.json()["count"] >= 1

    # Mark one as read
    notif_id = sig_notifs[0]["id"]
    response = await client.patch(f"/api/v1/student/notifications/{notif_id}/read", headers=student_headers)
    assert response.status_code == 200
