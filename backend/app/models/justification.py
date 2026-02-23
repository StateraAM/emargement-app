import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.attendance_record import AttendanceRecord
    from app.models.student import Student


class Justification(Base):
    __tablename__ = "justifications"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    attendance_record_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendance_records.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    file_paths: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of file paths
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | approved | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("professors.id"), nullable=True)

    attendance_record: Mapped["AttendanceRecord"] = relationship()
    student: Mapped["Student"] = relationship()
