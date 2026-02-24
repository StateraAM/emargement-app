import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class JustificationComment(Base):
    __tablename__ = "justification_comments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    justification_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("justifications.id"), nullable=False)
    author_type: Mapped[str] = mapped_column(String, nullable=False)  # "admin" | "student"
    author_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    author_name: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
