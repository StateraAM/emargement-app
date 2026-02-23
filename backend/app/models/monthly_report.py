import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Integer, Numeric, ForeignKey, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.student import Student
    from app.models.student_contact import StudentContact


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("student_contacts.id"), nullable=False)
    month: Mapped[date] = mapped_column(Date, nullable=False)
    total_courses: Mapped[int] = mapped_column(Integer, nullable=False)
    attended: Mapped[int] = mapped_column(Integer, nullable=False)
    absent: Mapped[int] = mapped_column(Integer, nullable=False)
    late: Mapped[int] = mapped_column(Integer, nullable=False)
    attendance_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    pdf_url: Mapped[str] = mapped_column(String, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship()
    contact: Mapped["StudentContact"] = relationship()
