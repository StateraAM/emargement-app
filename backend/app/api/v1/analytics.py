from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.auth import require_admin
from app.models.professor import Professor
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.student import Student
from app.schemas.analytics import (
    AttendanceTrendEntry,
    CourseAnalyticsEntry,
    StudentAtRiskEntry,
    ProfessorAnalyticsEntry,
    AnalyticsSummary,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------- 1. Attendance Trends ----------


@router.get("/attendance-trends", response_model=List[AttendanceTrendEntry])
async def get_attendance_trends(
    period: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    _admin: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Return attendance counts grouped by date period.
    Uses Python-based grouping for SQLite compatibility.
    """
    # Fetch all attendance records joined with their course (for start_time)
    stmt = (
        select(AttendanceRecord.status, Course.start_time)
        .join(Course, AttendanceRecord.course_id == Course.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Group by the appropriate period key
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0})

    for status, start_time in rows:
        if period == "daily":
            key = start_time.strftime("%Y-%m-%d")
        elif period == "weekly":
            # ISO year-week
            key = start_time.strftime("%G-W%V")
        else:  # monthly
            key = start_time.strftime("%Y-%m")

        if status in ("present", "absent", "late"):
            buckets[key][status] += 1

    # Sort by date key and return
    entries = [
        AttendanceTrendEntry(date=key, **counts)
        for key, counts in sorted(buckets.items())
    ]
    return entries


# ---------- 2. Courses Analytics ----------


@router.get("/courses", response_model=List[CourseAnalyticsEntry])
async def get_courses_analytics(
    _admin: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Per-course-name attendance stats.
    Groups by course name (not individual course instances).
    """
    stmt = (
        select(Course.name, AttendanceRecord.status, Course.id)
        .join(AttendanceRecord, AttendanceRecord.course_id == Course.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Accumulate stats per course name
    course_stats: dict[str, dict] = {}
    for course_name, status, course_id in rows:
        if course_name not in course_stats:
            course_stats[course_name] = {
                "total": 0, "present": 0, "late": 0,
                "sessions": set(), "students": set(),
            }
        stats = course_stats[course_name]
        stats["total"] += 1
        if status == "present":
            stats["present"] += 1
        elif status == "late":
            stats["late"] += 1
        stats["sessions"].add(course_id)

    # Count distinct students per course name
    stmt_students = (
        select(Course.name, AttendanceRecord.student_id)
        .join(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .distinct()
    )
    result_students = await db.execute(stmt_students)
    for course_name, student_id in result_students.all():
        if course_name in course_stats:
            course_stats[course_name]["students"].add(student_id)

    entries = []
    for name, stats in sorted(course_stats.items()):
        total = stats["total"]
        rate = ((stats["present"] + stats["late"]) / total * 100) if total > 0 else 0.0
        entries.append(CourseAnalyticsEntry(
            course_name=name,
            name=name,
            attendance_rate=round(rate, 2),
            rate=round(rate, 2),
            total_sessions=len(stats["sessions"]),
            total_students=len(stats["students"]),
        ))

    return entries


# ---------- 3. Students at Risk ----------


@router.get("/students-at-risk", response_model=List[StudentAtRiskEntry])
async def get_students_at_risk(
    threshold: float = Query(70, ge=0, le=100),
    _admin: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Students whose attendance rate is below the given threshold.
    """
    # Fetch all attendance records with student info
    stmt = (
        select(
            Student.id, Student.first_name, Student.last_name, Student.email,
            AttendanceRecord.status, AttendanceRecord.course_id,
        )
        .join(AttendanceRecord, AttendanceRecord.student_id == Student.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Accumulate per-student stats
    student_stats: dict[str, dict] = {}
    for sid, first_name, last_name, email, status, course_id in rows:
        sid_str = str(sid)
        if sid_str not in student_stats:
            student_stats[sid_str] = {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "total": 0,
                "present": 0,
                "late": 0,
                "absent": 0,
                "courses": set(),
            }
        s = student_stats[sid_str]
        s["total"] += 1
        s["courses"].add(course_id)
        if status == "present":
            s["present"] += 1
        elif status == "late":
            s["late"] += 1
        elif status == "absent":
            s["absent"] += 1

    entries = []
    for sid_str, s in student_stats.items():
        total = s["total"]
        rate = ((s["present"] + s["late"]) / total * 100) if total > 0 else 0.0
        if rate < threshold:
            entries.append(StudentAtRiskEntry(
                student_id=sid_str,
                student_name=f"{s['first_name']} {s['last_name']}",
                first_name=s["first_name"],
                last_name=s["last_name"],
                email=s["email"],
                attendance_rate=round(rate, 2),
                rate=round(rate, 2),
                total_courses=len(s["courses"]),
                absent=s["absent"],
            ))

    # Sort by attendance rate ascending (worst first)
    entries.sort(key=lambda e: e.attendance_rate)
    return entries


# ---------- 4. Professor Stats ----------


@router.get("/professors", response_model=List[ProfessorAnalyticsEntry])
async def get_professor_stats(
    _admin: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Per-professor: total courses, average attendance rate across their courses.
    """
    # Fetch professors with their courses and attendance records
    stmt = (
        select(
            Professor.id, Professor.first_name, Professor.last_name,
            Course.id.label("course_id"),
            AttendanceRecord.status,
        )
        .join(Course, Course.professor_id == Professor.id)
        .join(AttendanceRecord, AttendanceRecord.course_id == Course.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Accumulate per-professor, per-course stats
    prof_data: dict[str, dict] = {}
    for pid, first_name, last_name, course_id, status in rows:
        pid_str = str(pid)
        if pid_str not in prof_data:
            prof_data[pid_str] = {
                "first_name": first_name,
                "last_name": last_name,
                "courses": {},  # course_id -> {total, attended}
            }
        p = prof_data[pid_str]
        cid_str = str(course_id)
        if cid_str not in p["courses"]:
            p["courses"][cid_str] = {"total": 0, "attended": 0}
        p["courses"][cid_str]["total"] += 1
        if status in ("present", "late"):
            p["courses"][cid_str]["attended"] += 1

    entries = []
    for pid_str, p in prof_data.items():
        courses = p["courses"]
        total_courses = len(courses)
        # Average attendance rate across courses
        rates = []
        for c in courses.values():
            if c["total"] > 0:
                rates.append(c["attended"] / c["total"] * 100)
        avg_rate = sum(rates) / len(rates) if rates else 0.0

        entries.append(ProfessorAnalyticsEntry(
            professor_name=f"{p['first_name']} {p['last_name']}",
            first_name=p["first_name"],
            last_name=p["last_name"],
            total_courses=total_courses,
            courses_count=total_courses,
            average_attendance_rate=round(avg_rate, 2),
        ))

    entries.sort(key=lambda e: e.professor_name)
    return entries


# ---------- 5. Summary ----------


@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    _admin: Professor = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Global dashboard aggregations.
    """
    # Count total students
    total_students_result = await db.execute(select(func.count(Student.id)))
    total_students = total_students_result.scalar() or 0

    # Count total distinct course names
    total_courses_result = await db.execute(select(func.count(func.distinct(Course.name))))
    total_courses = total_courses_result.scalar() or 0

    # Attendance counts
    total_records_result = await db.execute(select(func.count(AttendanceRecord.id)))
    total_records = total_records_result.scalar() or 0

    present_result = await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status == "present")
    )
    total_present = present_result.scalar() or 0

    absent_result = await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status == "absent")
    )
    total_absent = absent_result.scalar() or 0

    late_result = await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status == "late")
    )
    total_late = late_result.scalar() or 0

    global_rate = ((total_present + total_late) / total_records * 100) if total_records > 0 else 0.0

    return AnalyticsSummary(
        total_students=total_students,
        total_courses=total_courses,
        total_records=total_records,
        global_attendance_rate=round(global_rate, 2),
        total_present=total_present,
        total_absent=total_absent,
        total_late=total_late,
    )
