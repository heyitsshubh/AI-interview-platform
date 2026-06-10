"""
Resume model - tracks uploaded resumes and their processing state.
"""
import uuid
from enum import Enum as PyEnum
from sqlalchemy import String, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ResumeStatus(str, PyEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class Resume(Base):
    __tablename__ = "resumes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum(ResumeStatus, name="resume_status_enum"),
        default=ResumeStatus.PENDING,
        nullable=False
    )
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="resumes")
    interviews: Mapped[list["Interview"]] = relationship("Interview", back_populates="resume")

    def __repr__(self) -> str:
        return f"<Resume id={self.id} user_id={self.user_id} status={self.status}>"
