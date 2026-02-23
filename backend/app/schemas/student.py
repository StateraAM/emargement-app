from typing import Optional
from pydantic import BaseModel


class StudentResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    is_alternance: bool

    class Config:
        from_attributes = True


class StudentWithAttendanceResponse(StudentResponse):
    attendance_rate: Optional[float] = None
    total_courses: int = 0
    attended: int = 0
    absent: int = 0
    late: int = 0
