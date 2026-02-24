from pydantic import BaseModel
from typing import Optional


class AttendanceTrendEntry(BaseModel):
    date: str
    present: int
    absent: int
    late: int


class CourseAnalyticsEntry(BaseModel):
    course_name: str
    name: Optional[str] = None
    attendance_rate: float
    rate: Optional[float] = None
    total_sessions: int
    total_students: int


class StudentAtRiskEntry(BaseModel):
    student_id: str
    student_name: str
    first_name: str
    last_name: str
    email: str
    attendance_rate: float
    rate: Optional[float] = None
    total_courses: int
    absent: int


class ProfessorAnalyticsEntry(BaseModel):
    professor_name: str
    first_name: str
    last_name: str
    total_courses: int
    courses_count: Optional[int] = None
    average_attendance_rate: float


class AnalyticsSummary(BaseModel):
    total_students: int
    total_courses: int
    total_records: int
    global_attendance_rate: float
    total_present: int
    total_absent: int
    total_late: int
