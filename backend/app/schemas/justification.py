from datetime import datetime
from pydantic import BaseModel


class JustificationResponse(BaseModel):
    id: str
    attendance_record_id: str
    reason: str
    file_urls: list[str]
    status: str  # pending | approved | rejected
    created_at: datetime
    course_name: str
    course_date: str
