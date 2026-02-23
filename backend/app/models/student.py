import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.student_contact import StudentContact
    from app.models.course_enrollment import CourseEnrollment
    from app.models.attendance_record import AttendanceRecord
    from app.models.notification import Notification


class Student(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_alternance: Mapped[bool] = mapped_column(Boolean, default=False)
    galia_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    contacts: Mapped[List["StudentContact"]] = relationship(back_populates="student")
    enrollments: Mapped[List["CourseEnrollment"]] = relationship(back_populates="student")
    attendance_records: Mapped[List["AttendanceRecord"]] = relationship(back_populates="student")
    notifications: Mapped[List["Notification"]] = relationship(back_populates="student")
