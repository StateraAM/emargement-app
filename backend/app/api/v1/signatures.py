import uuid as uuid_mod
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.attendance_record import AttendanceRecord
from app.models.course import Course
from app.models.student import Student
from app.models.professor import Professor
from app.schemas.attendance import SignatureResponse

router = APIRouter(prefix="/signatures", tags=["signatures"])


class SignBody(BaseModel):
    signature_data: Optional[str] = None


def _parse_token(token: str) -> uuid_mod.UUID:
    try:
        return uuid_mod.UUID(token)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid signature token")


@router.get("/info/{token}", response_model=SignatureResponse)
async def get_signature_info(token: str, db: AsyncSession = Depends(get_db)):
    token_uuid = _parse_token(token)
    stmt = (
        select(AttendanceRecord, Course, Student, Professor)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .join(Professor, Professor.id == Course.professor_id)
        .where(AttendanceRecord.signature_token == token_uuid)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Invalid signature token")

    record, course, student, professor = row

    if record.signature_token_expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Signature link expired")

    return SignatureResponse(
        course_name=course.name,
        course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
        professor_name=f"{professor.first_name} {professor.last_name}",
        student_name=f"{student.first_name} {student.last_name}",
        already_signed=record.signed_at is not None,
    )


@router.post("/sign/{token}", response_model=SignatureResponse)
async def sign_attendance(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    body: SignBody = SignBody(),
):
    token_uuid = _parse_token(token)
    stmt = (
        select(AttendanceRecord, Course, Student, Professor)
        .join(Course, Course.id == AttendanceRecord.course_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .join(Professor, Professor.id == Course.professor_id)
        .where(AttendanceRecord.signature_token == token_uuid)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Invalid signature token")

    record, course, student, professor = row

    if record.signature_token_expires < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Signature link expired")

    if record.signed_at:
        return SignatureResponse(
            course_name=course.name,
            course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
            professor_name=f"{professor.first_name} {professor.last_name}",
            student_name=f"{student.first_name} {student.last_name}",
            already_signed=True,
            signed=False,
        )

    # Record the signature
    record.signed_at = datetime.utcnow()
    record.signature_ip = request.client.host if request.client else None
    record.signature_user_agent = request.headers.get("user-agent")
    if body.signature_data:
        record.signature_data = body.signature_data
    await db.commit()

    return SignatureResponse(
        course_name=course.name,
        course_date=course.start_time.strftime("%d/%m/%Y %H:%M"),
        professor_name=f"{professor.first_name} {professor.last_name}",
        student_name=f"{student.first_name} {student.last_name}",
        already_signed=False,
        signed=True,
    )
