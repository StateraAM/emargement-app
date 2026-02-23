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
