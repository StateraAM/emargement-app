from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.auth import get_current_external
from app.models.student_contact import StudentContact
from app.models.student import Student
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.monthly_report import MonthlyReport

router = APIRouter(prefix="/external", tags=["external"])


@router.get("/dashboard")
async def external_dashboard(
    contact: StudentContact = Depends(get_current_external),
    db: AsyncSession = Depends(get_db),
):
    student = (await db.execute(select(Student).where(Student.id == contact.student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    total = (await db.execute(
        select(func.count(AttendanceRecord.id)).where(AttendanceRecord.student_id == student.id)
    )).scalar() or 0
    present = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "present")
    )).scalar() or 0
    absent = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "absent")
    )).scalar() or 0
    late = (await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.student_id == student.id, AttendanceRecord.status == "late")
    )).scalar() or 0
    rate = (present / total * 100) if total > 0 else 0

    history_stmt = (
        select(AttendanceRecord, Course)
        .join(Course, AttendanceRecord.course_id == Course.id)
        .where(AttendanceRecord.student_id == student.id)
        .order_by(Course.start_time.desc())
    )
    history_result = await db.execute(history_stmt)
    history = [
        {
            "course_name": course.name,
            "course_date": course.start_time.strftime("%d/%m/%Y %H:%M"),
            "room": course.room,
            "status": record.status,
            "signed_at": record.signed_at.isoformat() if record.signed_at else None,
        }
        for record, course in history_result.all()
    ]

    return {
        "student": {
            "first_name": student.first_name,
            "last_name": student.last_name,
            "email": student.email,
            "is_alternance": student.is_alternance,
        },
        "stats": {
            "total_courses": total,
            "present": present,
            "absent": absent,
            "late": late,
            "attendance_rate": round(rate, 1),
        },
        "history": history,
    }


@router.get("/reports")
async def list_reports(
    contact: StudentContact = Depends(get_current_external),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(MonthlyReport)
        .where(MonthlyReport.student_id == contact.student_id)
        .order_by(MonthlyReport.month.desc())
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "month": r.month.isoformat(),
            "total_courses": r.total_courses,
            "attended": r.attended,
            "absent": r.absent,
            "late": r.late,
            "attendance_rate": float(r.attendance_rate) if r.attendance_rate else None,
        }
        for r in reports
    ]
