import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.student import Student


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)  # present | absent | late
    marked_by_prof_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signature_token: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4)
    signature_token_expires: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signature_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    signature_user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    signature_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    qr_signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    course: Mapped["Course"] = relationship(back_populates="attendance_records")
    student: Mapped["Student"] = relationship(back_populates="attendance_records")
