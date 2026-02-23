import uuid
from datetime import datetime, timedelta
import pytest
import pytest_asyncio
from tests.conftest import async_session_test
from app.models.attendance_record import AttendanceRecord
from app.models.student import Student
from app.models.course import Course
from sqlalchemy import select


async def get_prof_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def get_student_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "alice.martin@student.fr", "password": "student123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def get_bob_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "bob.bernard@student.fr", "password": "student123"})
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


@pytest.mark.asyncio
async def test_get_attendance_record(client):
    """GET /student/attendance/{id} returns record info."""
    student_headers = await get_student_header(client)

    # Alice already has attendance records from prior tests (test_validate_attendance, test_notification_created_on_validate)
    response = await client.get("/api/v1/student/attendance-history", headers=student_headers)
    assert response.status_code == 200
    history = response.json()
    assert len(history) >= 1

    record_id = history[0]["id"]

    # Test the new endpoint
    response = await client.get(f"/api/v1/student/attendance/{record_id}", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == record_id
    assert "course_name" in data
    assert "course_date" in data
    assert "professor_name" in data
    assert "status" in data


@pytest.mark.asyncio
async def test_get_attendance_record_not_found(client):
    """GET /student/attendance/{id} returns 404 for non-existent record."""
    student_headers = await get_student_header(client)
    import uuid
    fake_id = str(uuid.uuid4())
    response = await client.get(f"/api/v1/student/attendance/{fake_id}", headers=student_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_justify_absence(client):
    """POST /student/justify/{record_id} creates justification for an absent record.

    Creates an absent record directly in the DB for Claire in a course,
    then logs in as Claire to justify it.
    """
    # Create an absent record directly in the DB for Claire
    async with async_session_test() as db:
        # Find Claire
        result = await db.execute(select(Student).where(Student.email == "claire.petit@student.fr"))
        claire = result.scalar_one()

        # Find a course
        result = await db.execute(select(Course).limit(1))
        course = result.scalar_one()

        # Check if Claire already has a record for this course
        result = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.student_id == claire.id,
                AttendanceRecord.course_id == course.id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            # Update existing record to absent
            existing.status = "absent"
            record_id = str(existing.id)
        else:
            # Create a new absent record
            now = datetime.utcnow()
            record = AttendanceRecord(
                id=uuid.uuid4(),
                course_id=course.id,
                student_id=claire.id,
                status="absent",
                marked_by_prof_at=now,
                signature_token=uuid.uuid4(),
                signature_token_expires=now + timedelta(hours=24),
            )
            db.add(record)
            record_id = str(record.id)
        await db.commit()

    # Login as Claire
    claire_login = await client.post("/api/v1/auth/login", json={"email": "claire.petit@student.fr", "password": "student123"})
    assert claire_login.status_code == 200
    claire_headers = {"Authorization": f"Bearer {claire_login.json()['access_token']}"}

    # Submit justification (no files, just reason)
    response = await client.post(
        f"/api/v1/student/justify/{record_id}",
        headers=claire_headers,
        data={"reason": "Medical appointment"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert "justification_id" in data

    # Store for later tests
    test_justify_absence.claire_headers = claire_headers
    test_justify_absence.record_id = record_id


@pytest.mark.asyncio
async def test_justify_duplicate_rejected(client):
    """POST /student/justify/{record_id} rejects duplicate justification."""
    claire_headers = getattr(test_justify_absence, "claire_headers", None)
    record_id = getattr(test_justify_absence, "record_id", None)
    if not claire_headers or not record_id:
        pytest.skip("Depends on test_justify_absence")

    # Try to submit again — should fail
    response = await client.post(
        f"/api/v1/student/justify/{record_id}",
        headers=claire_headers,
        data={"reason": "Another reason"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_justifications(client):
    """GET /student/justifications lists justifications."""
    claire_headers = getattr(test_justify_absence, "claire_headers", None)
    if not claire_headers:
        pytest.skip("Depends on test_justify_absence")

    response = await client.get("/api/v1/student/justifications", headers=claire_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    j = data[0]
    assert "id" in j
    assert "reason" in j
    assert "status" in j
    assert "course_name" in j
    assert "course_date" in j
    assert j["reason"] == "Medical appointment"


@pytest.mark.asyncio
async def test_attendance_history_includes_justification(client):
    """GET /student/attendance-history includes justification_status and justification_id."""
    claire_headers = getattr(test_justify_absence, "claire_headers", None)
    if not claire_headers:
        pytest.skip("Depends on test_justify_absence")

    response = await client.get("/api/v1/student/attendance-history", headers=claire_headers)
    assert response.status_code == 200
    history = response.json()
    # Find the record that has a justification
    justified = next((r for r in history if r.get("justification_status") is not None), None)
    assert justified is not None
    assert justified["justification_status"] == "pending"
    assert justified["justification_id"] is not None
