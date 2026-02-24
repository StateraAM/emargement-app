import csv
import io
import re
import zipfile
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import require_admin
from app.models.student import Student
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.services.pdf import generate_certificate_pdf

router = APIRouter(prefix="/admin/exports", tags=["exports"], dependencies=[Depends(require_admin)])

SCHOOL_NAME = "Ecole de Commerce"


def _parse_iso_datetime(value: str) -> datetime:
    """Parse an ISO 8601 datetime string, handling +HH:MM timezone offsets
    that Python 3.9's datetime.fromisoformat() does not support."""
    # Strip timezone offset like +02:00 or -05:30 for compatibility with Python 3.9
    cleaned = re.sub(r"[+-]\d{2}:\d{2}$", "", value)
    return datetime.fromisoformat(cleaned)


class CertificateRequest(BaseModel):
    student_id: str
    start_date: str
    end_date: str


async def _compute_student_hours(db: AsyncSession, student_id, start_dt, end_dt):
    from uuid import UUID
    sid = UUID(student_id) if isinstance(student_id, str) else student_id

    planned_stmt = (
        select(Course)
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .where(
            CourseEnrollment.student_id == sid,
            Course.start_time >= start_dt,
            Course.end_time <= end_dt,
        )
    )
    planned_courses = (await db.execute(planned_stmt)).scalars().all()
    total_planned = sum(
        (c.end_time - c.start_time).total_seconds() / 3600 for c in planned_courses
    )

    realized_stmt = (
        select(Course)
        .join(AttendanceRecord, AttendanceRecord.course_id == Course.id)
        .where(
            AttendanceRecord.student_id == sid,
            AttendanceRecord.status.in_(["present", "late"]),
            Course.start_time >= start_dt,
            Course.end_time <= end_dt,
        )
    )
    realized_courses = (await db.execute(realized_stmt)).scalars().all()
    total_realized = sum(
        (c.end_time - c.start_time).total_seconds() / 3600 for c in realized_courses
    )

    rate = (total_realized / total_planned * 100) if total_planned > 0 else 0
    return total_planned, total_realized, rate


@router.post("/certificate")
async def generate_certificate(
    body: CertificateRequest,
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    student = (await db.execute(select(Student).where(Student.id == UUID(body.student_id)))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    start_dt = _parse_iso_datetime(body.start_date)
    end_dt = _parse_iso_datetime(body.end_date + "T23:59:59")

    planned, realized, rate = await _compute_student_hours(db, student.id, start_dt, end_dt)

    pdf_bytes = generate_certificate_pdf(
        school_name=SCHOOL_NAME,
        student_name=f"{student.first_name} {student.last_name}",
        student_email=student.email,
        period_start=body.start_date,
        period_end=body.end_date,
        total_hours_planned=planned,
        total_hours_realized=realized,
        attendance_rate=rate,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=certificat_{student.last_name}_{student.first_name}.pdf"},
    )


@router.post("/certificates-bulk")
async def generate_certificates_bulk(
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    start_dt = _parse_iso_datetime(start_date)
    end_dt = _parse_iso_datetime(end_date + "T23:59:59")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for student in students:
            planned, realized, rate = await _compute_student_hours(db, student.id, start_dt, end_dt)
            if planned == 0:
                continue
            pdf_bytes = generate_certificate_pdf(
                school_name=SCHOOL_NAME,
                student_name=f"{student.first_name} {student.last_name}",
                student_email=student.email,
                period_start=start_date,
                period_end=end_date,
                total_hours_planned=planned,
                total_hours_realized=realized,
                attendance_rate=rate,
            )
            zf.writestr(f"certificat_{student.last_name}_{student.first_name}.pdf", pdf_bytes)

    zip_buf.seek(0)
    return Response(
        content=zip_buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=certificats.zip"},
    )


@router.get("/opco")
async def export_opco(
    start_date: str,
    end_date: str,
    db: AsyncSession = Depends(get_db),
):
    students = (await db.execute(select(Student).order_by(Student.last_name))).scalars().all()
    start_dt = _parse_iso_datetime(start_date)
    end_dt = _parse_iso_datetime(end_date + "T23:59:59")

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["Nom", "Prenom", "Email", "Heures Prevues", "Heures Realisees", "Taux (%)"])

    for student in students:
        planned, realized, rate = await _compute_student_hours(db, student.id, start_dt, end_dt)
        if planned == 0:
            continue
        writer.writerow([
            student.last_name, student.first_name, student.email,
            f"{planned:.1f}", f"{realized:.1f}", f"{rate:.1f}",
        ])

    output.seek(0)
    return StreamingResponse(
        output, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export_opco.csv"},
    )
