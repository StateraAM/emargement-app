from app.models.professor import Professor
from app.models.student import Student
from app.models.student_contact import StudentContact
from app.models.course import Course
from app.models.course_enrollment import CourseEnrollment
from app.models.attendance_record import AttendanceRecord
from app.models.monthly_report import MonthlyReport
from app.models.notification import Notification
from app.models.justification import Justification
from app.models.audit_log import AuditLog
from app.models.justification_comment import JustificationComment

__all__ = [
    "Professor", "Student", "StudentContact",
    "Course", "CourseEnrollment", "AttendanceRecord", "MonthlyReport",
    "Notification", "Justification", "AuditLog", "JustificationComment",
]
