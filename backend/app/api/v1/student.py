import json
import os
import uuid as uuid_mod
from uuid import UUID
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import aliased
from app.core.database import get_db
from app.core.auth import get_current_student
from app.models.student import Student
from app.models.notification import Notification
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.professor import Professor
from app.models.justification import Justification
from app.schemas.notification import NotificationResponse
from app.schemas.attendance import SignatureSubmitRequest

router = APIRouter(prefix="/student", tags=["student"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "justifications"
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(Notification.student_id == student.id)
        .order_by(Notification.created_at.desc())
    )
    result = await db.execute(stmt)
    notifications = result.scalars().all()
    return [
        NotificationResponse(
            id=str(n.id), type=n.type, title=n.title,
            message=n.message, data=n.data, is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.get("/notifications/unread-count")
async def unread_count(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.student_id == student.id, Notification.is_read == False)
    )
    result = await db.execute(stmt)
    count = result.scalar()
    return {"count": count}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Notification).where(
        Notification.id == UUID(notification_id),
        Notification.student_id == student.id,
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"ok": True}


@router.post("/notifications/mark-all-read")
async def mark_all_read(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        update(Notification)
        .where(Notification.student_id == student.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.get("/attendance-history")
async def attendance_history(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AttendanceRecord, Course, Justification)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .outerjoin(Justification, Justification.attendance_record_id == AttendanceRecord.id)
        .where(AttendanceRecord.student_id == student.id)
        .order_by(Course.start_time.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": str(record.id),
            "course_name": course.name,
            "course_date": course.start_time.strftime("%d/%m/%Y %H:%M"),
            "room": course.room,
            "status": record.status,
            "signed_at": record.signed_at.isoformat() if record.signed_at else None,
            "qr_signed_at": record.qr_signed_at.isoformat() if record.qr_signed_at else None,
            "justification_status": justification.status if justification else None,
            "justification_id": str(justification.id) if justification else None,
        }
        for record, course, justification in rows
    ]


@router.get("/attendance/{record_id}")
async def get_attendance_record(
    record_id: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AttendanceRecord, Course)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .where(AttendanceRecord.id == UUID(record_id), AttendanceRecord.student_id == student.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    record, course = row
    prof_result = await db.execute(select(Professor).where(Professor.id == course.professor_id))
    prof = prof_result.scalar_one_or_none()
    return {
        "id": str(record.id),
        "course_name": course.name,
        "course_date": course.start_time.strftime("%d/%m/%Y %H:%M"),
        "professor_name": f"{prof.first_name} {prof.last_name}" if prof else "",
        "status": record.status,
        "signed_at": record.signed_at.isoformat() if record.signed_at else None,
    }


@router.post("/sign/{record_id}")
async def sign_attendance_record(
    record_id: str,
    body: SignatureSubmitRequest = SignatureSubmitRequest(),
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AttendanceRecord).where(
        AttendanceRecord.id == UUID(record_id),
        AttendanceRecord.student_id == student.id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if record.signed_at:
        raise HTTPException(status_code=400, detail="Already signed")

    if record.signature_token_expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Signature link expired")

    record.signed_at = datetime.utcnow()
    if body.signature_data:
        record.signature_data = body.signature_data
    await db.commit()

    return {"ok": True, "signed_at": record.signed_at.isoformat()}


@router.post("/justify/{record_id}")
async def justify_absence(
    record_id: str,
    reason: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    # Verify the attendance record exists and belongs to the student
    stmt = select(AttendanceRecord).where(
        AttendanceRecord.id == UUID(record_id),
        AttendanceRecord.student_id == student.id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    # Only allow justification for absent or late
    if record.status not in ("absent", "late"):
        raise HTTPException(status_code=400, detail="Can only justify absent or late records")

    # Check if justification already exists
    existing = await db.execute(
        select(Justification).where(Justification.attendance_record_id == record.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Justification already submitted for this record")

    # Validate files
    for f in files:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    # Create justification
    justification_id = uuid_mod.uuid4()
    saved_paths = []

    if files:
        upload_dir = UPLOADS_DIR / str(justification_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        for f in files:
            content = await f.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail=f"File {f.filename} exceeds 10MB limit")
            file_path = upload_dir / f.filename
            file_path.write_bytes(content)
            saved_paths.append(f.filename)

    justification = Justification(
        id=justification_id,
        attendance_record_id=record.id,
        student_id=student.id,
        reason=reason,
        file_paths=json.dumps(saved_paths) if saved_paths else None,
        status="pending",
    )
    db.add(justification)
    await db.commit()

    return {
        "ok": True,
        "justification_id": str(justification.id),
    }


@router.get("/justifications")
async def list_justifications(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Justification, Course)
        .join(AttendanceRecord, AttendanceRecord.id == Justification.attendance_record_id)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .where(Justification.student_id == student.id)
        .order_by(Justification.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": str(j.id),
            "attendance_record_id": str(j.attendance_record_id),
            "reason": j.reason,
            "file_urls": [
                f"/api/v1/student/justification-files/{j.id}/{fname}"
                for fname in (json.loads(j.file_paths) if j.file_paths else [])
            ],
            "status": j.status,
            "created_at": j.created_at.isoformat(),
            "course_name": course.name,
            "course_date": course.start_time.strftime("%d/%m/%Y %H:%M"),
        }
        for j, course in rows
    ]


@router.get("/justification-files/{justification_id}/{filename}")
async def serve_justification_file(
    justification_id: str,
    filename: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    stmt = select(Justification).where(
        Justification.id == UUID(justification_id),
        Justification.student_id == student.id,
    )
    result = await db.execute(stmt)
    justification = result.scalar_one_or_none()
    if not justification:
        raise HTTPException(status_code=404, detail="Justification not found")

    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    file_path = UPLOADS_DIR / justification_id / safe_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)
