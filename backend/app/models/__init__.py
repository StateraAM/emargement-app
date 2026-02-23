from app.models.professor import Professor
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.monthly_report import MonthlyReport

__all__ = [
    "Professor", "Student", "StudentContact",
    "Course", "CourseEnrollment", "AttendanceRecord", "MonthlyReport",
]
