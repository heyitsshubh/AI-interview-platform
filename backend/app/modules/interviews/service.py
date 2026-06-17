"""
Interview service: business logic for interview lifecycle.
"""
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.modules.interviews.repository import InterviewRepository
# BullMQ removed — evaluation is triggered via BackgroundTasks in the WebSocket route

logger = logging.getLogger(__name__)


class InterviewService:
    def __init__(self):
        self.repo = InterviewRepository()

    async def create_interview(
        self,
        db: AsyncSession,
        current_user,
        job_title: str,
        job_description: str | None,
        resume_id: uuid.UUID | None,
        total_questions: int = 10,
    ):
        """Create a new interview for the current candidate."""
        # Get latest resume if not provided
        if resume_id is None and "CANDIDATE" in current_user.roles:
            from sqlalchemy import select
            from app.modules.resumes.model import Resume
            result = await db.execute(
                select(Resume)
                .where(Resume.user_id == current_user.id)
                .order_by(Resume.created_at.desc())
                .limit(1)
            )
            latest_resume = result.scalar_one_or_none()
            resume_id = latest_resume.id if latest_resume else None

        interview = await self.repo.create_interview(
            db, current_user.id, resume_id, job_title, job_description, total_questions
        )
        return interview

    async def get_interview(self, db: AsyncSession, interview_id: uuid.UUID, current_user):
        """Get interview by ID. Owner or recruiter can access."""
        interview = await self.repo.get_interview(db, interview_id)
        if not interview:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

        if interview.user_id != current_user.id and "RECRUITER" not in current_user.roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        return interview

    async def get_history(self, db: AsyncSession, current_user) -> list:
        """Get interview history. Candidates see own, recruiters see all."""
        if "RECRUITER" in current_user.roles:
            return await self.repo.get_all_interviews(db)
        return await self.repo.get_user_interviews(db, current_user.id)

    async def start_interview(self, db: AsyncSession, interview_id: uuid.UUID, current_user) -> dict:
        """Start an interview: set status ACTIVE and generate questions via AI."""
        interview = await self.get_interview(db, interview_id, current_user)

        if interview.status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start interview in status {interview.status}",
            )

        # Get resume text
        resume_text = ""
        if interview.resume_id:
            from sqlalchemy import select
            from app.modules.resumes.model import Resume
            result = await db.execute(select(Resume).where(Resume.id == interview.resume_id))
            resume = result.scalar_one_or_none()
            if resume and resume.extracted_text:
                resume_text = resume.extracted_text

        # Generate questions using AI
        try:
            from app.ai.agents.graph import run_question_generation
            questions = await run_question_generation(
                resume_text=resume_text,
                job_title=interview.job_title,
                total_questions=interview.total_questions,
            )
        except Exception as exc:
            logger.error(f"Question generation failed: {exc}")
            # Fallback questions
            questions = [
                {"text": f"Tell me about your experience with {interview.job_title}.", "type": "BEHAVIORAL", "order_index": 1},
                {"text": "Describe a challenging project you worked on.", "type": "BEHAVIORAL", "order_index": 2},
                {"text": "What are your core technical skills?", "type": "TECHNICAL", "order_index": 3},
            ]

        # Save questions to DB
        saved_questions = []
        for q in questions:
            saved_q = await self.repo.add_question(
                db,
                interview_id=interview_id,
                text=q["text"],
                order_index=q.get("order_index", 0),
                question_type=q.get("type", "TECHNICAL"),
            )
            saved_questions.append(saved_q)

        await self.repo.update_status(db, interview_id, "ACTIVE")
        logger.info(f"Interview {interview_id} started with {len(saved_questions)} questions")
        return {"status": "ACTIVE", "questions_generated": len(saved_questions)}

    async def complete_interview(self, db: AsyncSession, interview_id: uuid.UUID, current_user) -> dict:
        """Mark interview as completed and create report record."""
        interview = await self.get_interview(db, interview_id, current_user)

        if interview.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete interview in status {interview.status}",
            )

        await self.repo.update_status(db, interview_id, "COMPLETED")
        await self.repo.create_report(db, interview_id)

        # Evaluation is triggered by the WebSocket route via BackgroundTasks
        logger.info(f"Interview {interview_id} marked COMPLETED, evaluation will run in background")
        return {"status": "COMPLETED"}

    async def get_interview_questions(self, db: AsyncSession, interview_id: uuid.UUID) -> list:
        return await self.repo.get_questions(db, interview_id)
