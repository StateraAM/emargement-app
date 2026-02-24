import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.student import Student


class StudentContact(Base):
    __tablename__ = "student_contacts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # parent | tutor
    email: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    student: Mapped["Student"] = relationship(back_populates="contacts")
