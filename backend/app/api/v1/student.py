import json
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.core.database import get_db
from app.core.auth import get_current_student
from app.models.student import Student
from app.models.notification import Notification
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.schemas.notification import NotificationResponse
from app.schemas.attendance import SignatureSubmitRequest

router = APIRouter(prefix="/student", tags=["student"])


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
        select(AttendanceRecord, Course)
        .join(Course, Course.id == AttendanceRecord.course_id)
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
        }
        for record, course in rows
    ]


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
