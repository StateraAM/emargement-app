from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class AttendanceEntry(BaseModel):
    student_id: str
    status: str  # present | absent | late


class ValidateAttendanceRequest(BaseModel):
    course_id: str
    entries: List[AttendanceEntry]


class AttendanceRecordResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    status: str
    signed_at: Optional[datetime] = None
    qr_signed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignatureRequest(BaseModel):
    pass  # No body needed, token is in URL path


class SignatureResponse(BaseModel):
    course_name: str
    course_date: str
    professor_name: str
    student_name: str
    already_signed: bool = False
    signed: bool = False
