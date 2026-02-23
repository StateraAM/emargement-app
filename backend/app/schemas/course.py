from datetime import datetime
from pydantic import BaseModel


class CourseResponse(BaseModel):
    id: str
    name: str
    room: str
    start_time: datetime
    end_time: datetime
    professor_name: str
    student_count: int

    class Config:
        from_attributes = True
