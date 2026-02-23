from datetime import date, datetime
from pydantic import BaseModel


class MonthlyReportResponse(BaseModel):
    id: str
    student_name: str
    contact_name: str
    month: date
    total_courses: int
    attended: int
    absent: int
    late: int
    attendance_rate: float
    sent_at: datetime

    class Config:
        from_attributes = True
