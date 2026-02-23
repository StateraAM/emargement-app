from datetime import date, datetime, time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import require_admin
from app.models.professor import Professor
from app.models.student import Student
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.schemas.student import StudentWithAttendanceResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    total_professors = (await db.execute(select(func.count(Professor.id)))).scalar() or 0

    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)
    total_courses_today = (await db.execute(
        select(func.count(Course.id)).where(Course.start_time >= start, Course.start_time <= end)
    )).scalar() or 0

    # Global attendance rate
    total_records = (await db.execute(select(func.count(AttendanceRecord.id)))).scalar() or 0
    present_records = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status.in_(["present", "late"]))
    )).scalar() or 0
    global_rate = (present_records / total_records * 100) if total_records > 0 else 0

    # Alerts: students with rate < 70%
    low_attendance_count = 0  # Simplified for MVP

    return {
        "total_students": total_students,
        "total_professors": total_professors,
        "total_courses_today": total_courses_today,
        "global_attendance_rate": round(global_rate, 1),
        "total_attendance_records": total_records,
        "low_attendance_alerts": low_attendance_count,
    }


@router.get("/students", response_model=list[StudentWithAttendanceResponse])
async def get_students(db: AsyncSession = Depends(get_db)):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    result = []
    for s in students:
        # Get attendance stats
        total = (await db.execute(
            select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == s.id)
        )).scalar() or 0
        attended = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "present")
        )).scalar() or 0
        absent = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "absent")
        )).scalar() or 0
        late = (await db.execute(
            select(func.count(AttendanceRecord.id))
            .where(AttendanceRecord.student_id == s.id, AttendanceRecord.status == "late")
        )).scalar() or 0
        rate = (attended / total * 100) if total > 0 else None

        result.append(StudentWithAttendanceResponse(
            id=str(s.id), email=s.email, first_name=s.first_name,
            last_name=s.last_name, is_alternance=s.is_alternance,
            attendance_rate=round(rate, 1) if rate is not None else None,
            total_courses=total, attended=attended, absent=absent, late=late,
        ))
    return result
