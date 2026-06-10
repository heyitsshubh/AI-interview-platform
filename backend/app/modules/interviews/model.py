"""
Interview-related SQLAlchemy models:
Interview, Question, Answer, Report, Job
"""
import uuid
from enum import Enum as PyEnum
from sqlalchemy import String, Text, Float, Integer, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InterviewStatus(str, PyEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class QuestionType(str, PyEnum):
    TECHNICAL = "TECHNICAL"
    BEHAVIORAL = "BEHAVIORAL"
    SITUATIONAL = "SITUATIONAL"


class ReportStatus(str, PyEnum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    DONE = "DONE"
    FAILED = "FAILED"


class JobStatus(str, PyEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class Interview(Base):
    __tablename__ = "interviews"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resumes.id", ondelete="SET NULL"), nullable=True
    )
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(InterviewStatus, name="interview_status_enum"),
        default=InterviewStatus.PENDING,
        nullable=False
    )
    total_questions: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="interviews")
    resume: Mapped["Resume"] = relationship("Resume", back_populates="interviews")
    questions: Mapped[list["Question"]] = relationship("Question", back_populates="interview", lazy="selectin", order_by="Question.order_index")
    answers: Mapped[list["Answer"]] = relationship("Answer", back_populates="interview", lazy="selectin")
    report: Mapped["Report"] = relationship("Report", back_populates="interview", uselist=False)
    cheating_events: Mapped[list["CheatingEvent"]] = relationship("CheatingEvent", back_populates="interview")

    def __repr__(self) -> str:
        return f"<Interview id={self.id} job_title={self.job_title} status={self.status}>"


class Question(Base):
    __tablename__ = "questions"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    question_type: Mapped[str] = mapped_column(
        Enum(QuestionType, name="question_type_enum"),
        default=QuestionType.TECHNICAL,
        nullable=False
    )

    interview: Mapped["Interview"] = relationship("Interview", back_populates="questions")
    answers: Mapped[list["Answer"]] = relationship("Answer", back_populates="question")

    def __repr__(self) -> str:
        return f"<Question id={self.id} order={self.order_index} type={self.question_type}>"


class Answer(Base):
    __tablename__ = "answers"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str | None] = mapped_column(Text, nullable=True)         # transcribed text
    audio_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # stored audio file
    score: Mapped[float | None] = mapped_column(Float, nullable=True)     # 0-10
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    interview: Mapped["Interview"] = relationship("Interview", back_populates="answers")
    question: Mapped["Question"] = relationship("Question", back_populates="answers")

    def __repr__(self) -> str:
        return f"<Answer id={self.id} question_id={self.question_id} score={self.score}>"


class Report(Base):
    __tablename__ = "reports"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    technical_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    communication_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    integrity_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # Reduced by cheating
    recommendation: Mapped[str | None] = mapped_column(String(50), nullable=True)  # STRONG_HIRE/HIRE/MAYBE/REJECT
    feedback_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(ReportStatus, name="report_status_enum"),
        default=ReportStatus.PENDING,
        nullable=False
    )

    interview: Mapped["Interview"] = relationship("Interview", back_populates="report")

    def __repr__(self) -> str:
        return f"<Report id={self.id} interview_id={self.interview_id} status={self.status}>"


class Job(Base):
    __tablename__ = "jobs"

    queue_name: Mapped[str] = mapped_column(String(100), nullable=False)
    job_ref_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # BullMQ job id
    status: Mapped[str] = mapped_column(
        Enum(JobStatus, name="job_status_enum"),
        default=JobStatus.QUEUED,
        nullable=False
    )
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<Job id={self.id} queue={self.queue_name} status={self.status}>"
