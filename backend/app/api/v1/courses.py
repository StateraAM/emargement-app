from uuid import UUID
from datetime import date, datetime, time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import get_current_professor
from app.models.professor import Professor
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.student import Student
from app.schemas.course import CourseResponse
from app.schemas.student import StudentResponse

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("/today", response_model=list[CourseResponse])
async def get_today_courses(
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)

    # Get courses with student count
    stmt = (
        select(
            Course,
            func.count(CourseEnrollment.id).label("student_count"),
        )
        .outerjoin(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .where(Course.professor_id == professor.id)
        .where(Course.start_time >= start)
        .where(Course.start_time <= end)
        .group_by(Course.id)
        .order_by(Course.start_time)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        CourseResponse(
            id=str(course.id),
            name=course.name,
            room=course.room,
            start_time=course.start_time,
            end_time=course.end_time,
            professor_name=f"{professor.first_name} {professor.last_name}",
            student_count=count,
        )
        for course, count in rows
    ]


@router.get("/history")
async def get_course_history(
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    # All courses for this professor, ordered by date descending
    stmt = (
        select(
            Course,
            func.count(AttendanceRecord.id).label("total_records"),
            func.count().filter(AttendanceRecord.status == "present").label("present_count"),
            func.count().filter(AttendanceRecord.status == "absent").label("absent_count"),
            func.count().filter(AttendanceRecord.status == "late").label("late_count"),
        )
        .outerjoin(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .where(Course.professor_id == professor.id)
        .group_by(Course.id)
        .order_by(Course.start_time.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    # Count total
    count_stmt = select(func.count(Course.id)).where(Course.professor_id == professor.id)
    total = (await db.execute(count_stmt)).scalar() or 0

    # Check which courses have attendance validated
    course_ids = [row[0].id for row in rows]
    validated_ids = set()
    if course_ids:
        validated_stmt = (
            select(AttendanceRecord.course_id)
            .where(AttendanceRecord.course_id.in_(course_ids))
            .distinct()
        )
        validated_ids = set((await db.execute(validated_stmt)).scalars().all())

    # Count enrolled students per course
    enrollment_counts = {}
    if course_ids:
        enrollment_stmt = (
            select(CourseEnrollment.course_id, func.count(CourseEnrollment.id))
            .where(CourseEnrollment.course_id.in_(course_ids))
            .group_by(CourseEnrollment.course_id)
        )
        enrollment_counts = dict((await db.execute(enrollment_stmt)).all())

    return {
        "courses": [
            {
                "id": str(course.id),
                "name": course.name,
                "room": course.room,
                "date": course.start_time.strftime("%d/%m/%Y"),
                "start_time": course.start_time.strftime("%H:%M"),
                "end_time": course.end_time.strftime("%H:%M"),
                "student_count": enrollment_counts.get(course.id, 0),
                "present_count": present_count,
                "absent_count": absent_count,
                "late_count": late_count,
                "is_validated": course.id in validated_ids,
            }
            for course, total_records, present_count, absent_count, late_count in rows
        ],
        "total": total,
    }


@router.get("/{course_id}/students", response_model=list[StudentResponse])
async def get_course_students(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Student)
        .join(CourseEnrollment, CourseEnrollment.student_id == Student.id)
        .where(CourseEnrollment.course_id == UUID(course_id))
        .order_by(Student.last_name, Student.first_name)
    )
    result = await db.execute(stmt)
    students = result.scalars().all()

    return [
        StudentResponse(
            id=str(s.id), email=s.email,
            first_name=s.first_name, last_name=s.last_name,
            is_alternance=s.is_alternance,
        )
        for s in students
    ]
