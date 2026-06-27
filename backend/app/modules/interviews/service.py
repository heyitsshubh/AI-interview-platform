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
        """Create a new interview and immediately pre-generate questions in background."""
        from sqlalchemy import select
        from app.modules.resumes.model import Resume

        validated_resume_id = None

        if resume_id is not None:
            result = await db.execute(
                select(Resume).where(
                    Resume.id == resume_id,
                    Resume.user_id == current_user.id
                )
            )
            resume = result.scalar_one_or_none()
            if resume:
                validated_resume_id = resume.id
            else:
                logger.warning(f"Resume {resume_id} not found or doesn't belong to user — falling back to latest")

        if validated_resume_id is None and "CANDIDATE" in current_user.roles:
            result = await db.execute(
                select(Resume)
                .where(Resume.user_id == current_user.id)
                .order_by(Resume.created_at.desc())
                .limit(1)
            )
            latest_resume = result.scalar_one_or_none()
            validated_resume_id = latest_resume.id if latest_resume else None

        interview = await self.repo.create_interview(
            db, current_user.id, validated_resume_id, job_title, job_description, total_questions
        )
        await db.commit()

        # Pre-generate questions immediately in background so they're ready when user taps Start
        from app.tasks.celery_tasks import generate_questions_task
        generate_questions_task.delay(str(interview.id))
        logger.info(f"Interview {interview.id} created — question pre-generation dispatched immediately.")

        return interview



    async def get_interview(self, db: AsyncSession, interview_id: uuid.UUID, current_user):
        """Get interview by ID. Owner or recruiter can access."""
        interview = await self.repo.get_interview(db, interview_id)
        if not interview:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

        if interview.user_id != current_user.id and "RECRUITER" not in current_user.roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        return interview

    async def delete_interview(self, db: AsyncSession, interview_id: uuid.UUID, current_user):
        """Delete an interview (user must own it or be RECRUITER)."""
        interview = await self.get_interview(db, interview_id, current_user)
        # get_interview already checks ownership
        return await self.repo.delete_interview(db, interview_id)

    async def get_history(self, db: AsyncSession, current_user) -> list:
        """Get interview history. Candidates see own, recruiters see all."""
        if "RECRUITER" in current_user.roles:
            return await self.repo.get_all_interviews(db)
        return await self.repo.get_user_interviews(db, current_user.id)

    async def start_interview(self, db: AsyncSession, interview_id: uuid.UUID, current_user) -> dict:
        """Start an interview: set ACTIVE immediately if questions are pre-generated, else trigger generation."""
        interview = await self.get_interview(db, interview_id, current_user)

        if interview.status == "ACTIVE":
            logger.info(f"Interview {interview_id} is already ACTIVE.")
            return {"status": "ACTIVE"}

        if interview.status not in ("PENDING", "GENERATING"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start interview in status {interview.status}",
            )

        from sqlalchemy import select
        from app.modules.interviews.model import Question

        # Check if questions are already pre-generated
        result = await db.execute(select(Question).where(Question.interview_id == interview_id).limit(1))
        questions_ready = result.scalars().first() is not None

        if questions_ready:
            # Questions already exist — go ACTIVE instantly!
            await self.repo.update_status(db, interview_id, "ACTIVE")
            await db.commit()
            logger.info(f"Interview {interview_id} started instantly — questions were pre-generated.")
            return {"status": "ACTIVE"}
        else:
            # Questions not ready yet — trigger generation and tell frontend to wait
            await self.repo.update_status(db, interview_id, "GENERATING")
            await db.commit()
            from app.tasks.celery_tasks import generate_questions_task
            generate_questions_task.delay(str(interview_id))
            logger.info(f"Interview {interview_id} — questions not ready yet, re-dispatching generation.")
            return {"status": "GENERATING"}


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
