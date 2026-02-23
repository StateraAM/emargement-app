import uuid
import json
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_professor
from app.models.professor import Professor
from app.models.student import Student
from app.models.course import Course
from app.models.attendance_record import AttendanceRecord
from app.models.notification import Notification
from app.schemas.attendance import ValidateAttendanceRequest, AttendanceRecordResponse
from app.services.email import email_service
from app.services.qrcode import generate_qr_code
from app.core.config import settings

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/validate", response_model=list[AttendanceRecordResponse])
async def validate_attendance(
    request: ValidateAttendanceRequest,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    records = []

    # Get course info for email
    course = await db.get(Course, UUID(request.course_id))

    for entry in request.entries:
        student = await db.get(Student, UUID(entry.student_id))
        token = uuid.uuid4()
        record_id = uuid.uuid4()

        record = AttendanceRecord(
            id=record_id,
            course_id=UUID(request.course_id),
            student_id=UUID(entry.student_id),
            status=entry.status,
            marked_by_prof_at=now,
            signature_token=token,
            signature_token_expires=now + timedelta(hours=24),
        )
        db.add(record)
        records.append((record, student))

        # Send signature email + in-app notification to present/late students
        if entry.status in ("present", "late") and student:
            signature_url = f"{settings.FRONTEND_URL}/sign/{token}"
            await email_service.send_signature_email(
                student_email=student.email,
                student_name=f"{student.first_name} {student.last_name}",
                course_name=course.name if course else "Unknown",
                course_date=course.start_time.strftime("%d/%m/%Y %H:%M") if course else "",
                signature_url=signature_url,
            )

            # Create in-app notification
            notification_data = json.dumps({
                "record_id": str(record_id),
                "signature_token": str(token),
            })
            notification = Notification(
                student_id=student.id,
                type="signature_request",
                title="Signature requise",
                message=f"Veuillez signer votre presence pour le cours {course.name if course else 'Unknown'}",
                data=notification_data,
            )
            db.add(notification)

    await db.commit()

    return [
        AttendanceRecordResponse(
            id=str(record.id),
            student_id=str(record.student_id),
            student_name=f"{student.first_name} {student.last_name}" if student else "Unknown",
            status=record.status,
            signed_at=record.signed_at,
            qr_signed_at=record.qr_signed_at,
        )
        for record, student in records
    ]


@router.get("/{course_id}", response_model=list[AttendanceRecordResponse])
async def get_attendance(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AttendanceRecord, Student)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(AttendanceRecord.course_id == UUID(course_id))
        .order_by(Student.last_name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        AttendanceRecordResponse(
            id=str(record.id),
            student_id=str(record.student_id),
            student_name=f"{student.first_name} {student.last_name}",
            status=record.status,
            signed_at=record.signed_at,
            qr_signed_at=record.qr_signed_at,
        )
        for record, student in rows
    ]


@router.get("/{course_id}/qr")
async def get_qr_code(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
):
    qr_bytes = generate_qr_code(course_id)
    return Response(content=qr_bytes, media_type="image/png")
