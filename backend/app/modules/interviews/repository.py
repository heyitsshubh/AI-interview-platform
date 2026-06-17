"""
Interview repository: all database operations for interviews.
"""
import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class InterviewRepository:
    async def create_interview(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        resume_id: uuid.UUID | None,
        job_title: str,
        job_description: str | None,
        total_questions: int = 10,
    ):
        from app.modules.interviews.model import Interview

        interview = Interview(
            user_id=user_id,
            resume_id=resume_id,
            job_title=job_title,
            job_description=job_description,
            total_questions=total_questions,
        )
        db.add(interview)
        await db.flush()
        await db.commit()
        await db.refresh(interview)
        logger.info(f"Interview created: {interview.id}")
        return interview

    async def get_interview(self, db: AsyncSession, interview_id: uuid.UUID):
        from app.modules.interviews.model import Interview, Question

        result = await db.execute(
            select(Interview)
            .options(
                selectinload(Interview.questions),
                selectinload(Interview.answers),
            )
            .where(Interview.id == interview_id)
        )
        return result.scalar_one_or_none()

    async def get_user_interviews(self, db: AsyncSession, user_id: uuid.UUID) -> list:
        from app.modules.interviews.model import Interview

        result = await db.execute(
            select(Interview)
            .where(Interview.user_id == user_id)
            .order_by(Interview.created_at.desc())
        )
        return result.scalars().all()

    async def get_all_interviews(self, db: AsyncSession) -> list:
        from app.modules.interviews.model import Interview

        result = await db.execute(
            select(Interview).order_by(Interview.created_at.desc())
        )
        return result.scalars().all()

    async def update_status(self, db: AsyncSession, interview_id: uuid.UUID, new_status: str):
        from app.modules.interviews.model import Interview

        result = await db.execute(select(Interview).where(Interview.id == interview_id))
        interview = result.scalar_one_or_none()
        if not interview:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")
        interview.status = new_status
        await db.flush()
        return interview

    async def add_question(self, db: AsyncSession, interview_id: uuid.UUID, text: str, order_index: int, question_type: str):
        from app.modules.interviews.model import Question

        question = Question(
            interview_id=interview_id,
            text=text,
            order_index=order_index,
            question_type=question_type,
        )
        db.add(question)
        await db.flush()
        await db.refresh(question)
        return question

    async def get_questions(self, db: AsyncSession, interview_id: uuid.UUID) -> list:
        from app.modules.interviews.model import Question

        result = await db.execute(
            select(Question)
            .where(Question.interview_id == interview_id)
            .order_by(Question.order_index)
        )
        return result.scalars().all()

    async def save_answer(
        self,
        db: AsyncSession,
        interview_id: uuid.UUID,
        question_id: uuid.UUID,
        user_id: uuid.UUID,
        text: str | None = None,
        audio_path: str | None = None,
    ):
        from app.modules.interviews.model import Answer

        answer = Answer(
            interview_id=interview_id,
            question_id=question_id,
            user_id=user_id,
            text=text,
            audio_path=audio_path,
        )
        db.add(answer)
        await db.flush()
        await db.refresh(answer)
        return answer

    async def get_answers(self, db: AsyncSession, interview_id: uuid.UUID) -> list:
        from app.modules.interviews.model import Answer

        result = await db.execute(
            select(Answer).where(Answer.interview_id == interview_id)
        )
        return result.scalars().all()

    async def update_answer_score(
        self,
        db: AsyncSession,
        answer_id: uuid.UUID,
        score: float,
        feedback: str,
    ):
        from app.modules.interviews.model import Answer

        result = await db.execute(select(Answer).where(Answer.id == answer_id))
        answer = result.scalar_one_or_none()
        if not answer:
            return None
        answer.score = score
        answer.feedback = feedback
        await db.flush()
        return answer

    async def create_report(self, db: AsyncSession, interview_id: uuid.UUID):
        from app.modules.interviews.model import Report, ReportStatus

        # Check if report already exists
        result = await db.execute(
            select(Report).where(Report.interview_id == interview_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        report = Report(interview_id=interview_id, status=ReportStatus.PENDING)
        db.add(report)
        await db.flush()
        await db.refresh(report)
        return report

    async def update_report(self, db: AsyncSession, report_id: uuid.UUID, **kwargs):
        from app.modules.interviews.model import Report

        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            return None
        for key, value in kwargs.items():
            if hasattr(report, key):
                setattr(report, key, value)
        await db.flush()
        return report

    async def get_report(self, db: AsyncSession, interview_id: uuid.UUID):
        from app.modules.interviews.model import Report

        result = await db.execute(
            select(Report).where(Report.interview_id == interview_id)
        )
        return result.scalar_one_or_none()
