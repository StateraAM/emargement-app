import pytest


async def get_admin_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "admin@ecole.fr", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def get_prof_header(client):
    r = await client.post("/api/v1/auth/login", json={"email": "jean.dupont@ecole.fr", "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------- Attendance Trends ----------


@pytest.mark.asyncio
async def test_attendance_trends_daily(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/attendance-trends?period=daily", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        entry = data[0]
        assert "date" in entry
        assert "present" in entry
        assert "absent" in entry
        assert "late" in entry


@pytest.mark.asyncio
async def test_attendance_trends_weekly(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/attendance-trends?period=weekly", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_attendance_trends_monthly(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/attendance-trends?period=monthly", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_attendance_trends_default_period(client):
    """Without specifying period, should still work (default period)."""
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/attendance-trends", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# ---------- Courses Analytics ----------


@pytest.mark.asyncio
async def test_courses_analytics(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/courses", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        course = data[0]
        assert "course_name" in course or "name" in course
        assert "attendance_rate" in course or "rate" in course


# ---------- Students at Risk ----------


@pytest.mark.asyncio
async def test_students_at_risk_default_threshold(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/students-at-risk", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Each student should have identifying info and attendance rate
    if len(data) > 0:
        student = data[0]
        assert "student_name" in student or "name" in student or "first_name" in student
        assert "attendance_rate" in student or "rate" in student


@pytest.mark.asyncio
async def test_students_at_risk_custom_threshold(client):
    """With a high threshold, more students should be at risk."""
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/students-at-risk?threshold=100", headers=headers)
    assert response.status_code == 200
    data_high = response.json()
    assert isinstance(data_high, list)

    # With a low threshold, fewer (or no) students should be at risk
    response_low = await client.get("/api/v1/analytics/students-at-risk?threshold=0", headers=headers)
    assert response_low.status_code == 200
    data_low = response_low.json()
    assert len(data_low) <= len(data_high)


# ---------- Professor Stats ----------


@pytest.mark.asyncio
async def test_professor_stats(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/professors", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        prof = data[0]
        assert "professor_name" in prof or "name" in prof or "first_name" in prof
        assert "total_courses" in prof or "courses_count" in prof


# ---------- Summary ----------


@pytest.mark.asyncio
async def test_summary(client):
    headers = await get_admin_header(client)
    response = await client.get("/api/v1/analytics/summary", headers=headers)
    assert response.status_code == 200
    data = response.json()
    # Summary should contain aggregate stats
    assert isinstance(data, dict)
    # Should have at least some of these common summary fields
    has_expected_fields = any(
        key in data
        for key in [
            "total_students", "total_courses", "total_records",
            "global_attendance_rate", "attendance_rate",
            "total_present", "total_absent", "total_late",
        ]
    )
    assert has_expected_fields, f"Summary response missing expected fields: {list(data.keys())}"


# ---------- Auth Checks (non-admin gets 403) ----------


@pytest.mark.asyncio
async def test_analytics_requires_admin_trends(client):
    """Non-admin professor should get 403 on analytics endpoints."""
    headers = await get_prof_header(client)
    response = await client.get("/api/v1/analytics/attendance-trends", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_analytics_requires_admin_courses(client):
    headers = await get_prof_header(client)
    response = await client.get("/api/v1/analytics/courses", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_analytics_requires_admin_students_at_risk(client):
    headers = await get_prof_header(client)
    response = await client.get("/api/v1/analytics/students-at-risk", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_analytics_requires_admin_professors(client):
    headers = await get_prof_header(client)
    response = await client.get("/api/v1/analytics/professors", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_analytics_requires_admin_summary(client):
    headers = await get_prof_header(client)
    response = await client.get("/api/v1/analytics/summary", headers=headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_analytics_unauthenticated(client):
    """No auth header at all should get 401 or 403."""
    response = await client.get("/api/v1/analytics/summary")
    assert response.status_code in (401, 403)
