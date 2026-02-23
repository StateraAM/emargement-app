import uuid
import json
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
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
from app.schemas.attendance import ValidateAttendanceRequest, AttendanceRecordResponse, AttendanceStatusResponse
from app.services.email import email_service
from app.services.qrcode import generate_qr_code
from app.services.audit import create_audit_log
from app.core.config import settings

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/validate", response_model=list[AttendanceRecordResponse])
async def validate_attendance(
    request: ValidateAttendanceRequest,
    req: Request,
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

    await create_audit_log(
        db, "attendance_validation", "professor", professor.id, "course", UUID(request.course_id),
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
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


@router.put("/validate", response_model=list[AttendanceRecordResponse])
async def update_attendance(
    request: ValidateAttendanceRequest,
    req: Request,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    course = await db.get(Course, UUID(request.course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Cours introuvable")

    # Check if records already exist for this course
    existing_stmt = select(AttendanceRecord).where(
        AttendanceRecord.course_id == UUID(request.course_id)
    )
    existing_result = await db.execute(existing_stmt)
    existing_records = existing_result.scalars().all()

    if not existing_records:
        raise HTTPException(status_code=404, detail="Aucun emargement trouve pour ce cours")

    # Time check: deadline = start_time + (end_time - start_time) / 2
    duration = course.end_time - course.start_time
    deadline = course.start_time + duration / 2
    now = datetime.utcnow()

    if now > deadline.replace(tzinfo=None):
        raise HTTPException(
            status_code=403,
            detail="La moitie du cours est depassee, modification impossible",
        )

    # Build lookup of existing records by student_id
    record_by_student = {str(r.student_id): r for r in existing_records}

    updated = []
    for entry in request.entries:
        record = record_by_student.get(entry.student_id)
        if not record:
            continue  # skip students without an existing record

        old_status = record.status
        record.status = entry.status
        record.marked_by_prof_at = now

        student = await db.get(Student, UUID(entry.student_id))

        # If status changed to present/late and previously was absent (no signature sent yet)
        if entry.status in ("present", "late") and old_status == "absent" and student:
            token = uuid.uuid4()
            record.signature_token = token
            record.signature_token_expires = now + timedelta(hours=24)

            signature_url = f"{settings.FRONTEND_URL}/sign/{token}"
            await email_service.send_signature_email(
                student_email=student.email,
                student_name=f"{student.first_name} {student.last_name}",
                course_name=course.name,
                course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
                signature_url=signature_url,
            )

            notification_data = json.dumps({
                "record_id": str(record.id),
                "signature_token": str(token),
            })
            notification = Notification(
                student_id=student.id,
                type="signature_request",
                title="Signature requise",
                message=f"Veuillez signer votre presence pour le cours {course.name}",
                data=notification_data,
            )
            db.add(notification)

        updated.append((record, student, old_status))

    await create_audit_log(
        db, "attendance_edit", "professor", professor.id, "course", UUID(request.course_id),
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
        metadata={"changes": [
            {"student_id": str(r.student_id), "old_status": old, "new_status": r.status}
            for r, _, old in updated
        ]},
    )
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
        for record, student, _ in updated
    ]


@router.get("/{course_id}/status", response_model=AttendanceStatusResponse)
async def get_attendance_status(
    course_id: str,
    professor: Professor = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    course = await db.get(Course, UUID(course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Cours introuvable")

    # Check if attendance records exist
    stmt = select(AttendanceRecord).where(
        AttendanceRecord.course_id == UUID(course_id)
    ).limit(1)
    result = await db.execute(stmt)
    validated = result.scalar_one_or_none() is not None

    if not validated:
        return AttendanceStatusResponse(validated=False, editable=False, deadline=None)

    # Calculate deadline = start_time + (end_time - start_time) / 2
    duration = course.end_time - course.start_time
    deadline = course.start_time + duration / 2
    now = datetime.utcnow()
    editable = now <= deadline.replace(tzinfo=None)

    return AttendanceStatusResponse(
        validated=True,
        editable=editable,
        deadline=deadline.isoformat(),
    )


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
