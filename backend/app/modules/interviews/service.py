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
        from sqlalchemy import select
        from app.modules.resumes.model import Resume

        validated_resume_id = None

        if resume_id is not None:
            # Validate the resume exists AND belongs to this user
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

        # If no valid resume provided, auto-pick the latest DONE resume
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

        # Generate questions using Gemini directly (single API call, no LangGraph overhead)
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI, HarmCategory, HarmBlockThreshold
            from langchain_core.messages import HumanMessage
            from app.core.config import get_settings
            import json as json_mod
            import re

            cfg = get_settings()
            llm = ChatGoogleGenerativeAI(
                model="gemini-1.5-flash",
                google_api_key=cfg.GEMINI_API_KEY,
                temperature=0.7,
                safety_settings={
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                }
            )

            total_q = interview.total_questions
            technical_count = max(1, int(total_q * 0.4))
            behavioral_count = max(1, int(total_q * 0.35))
            situational_count = max(1, total_q - technical_count - behavioral_count)

            resume_context = f"\n\nResume text:\n{resume_text[:4000]}" if resume_text else ""

            prompt = f"""Generate exactly {total_q} interview questions for a {interview.job_title} position.{resume_context}

Make sure the questions are deeply tailored to the candidate's specific experience and skills mentioned in the resume.

Question distribution:
- TECHNICAL: {technical_count} questions
- BEHAVIORAL: {behavioral_count} questions  
- SITUATIONAL: {situational_count} questions

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {{"text": "Question here?", "type": "TECHNICAL", "order_index": 1}},
  ...
]"""

            response = await llm.ainvoke([HumanMessage(content=prompt)])
            content = response.content.strip()
            
            # Use regex to robustly extract the JSON array
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                content = match.group(0)
            else:
                logger.warning(f"Regex failed to find JSON array, raw content: {content[:200]}")
                
            questions = json_mod.loads(content)
            
            # Ensure order_index is set correctly
            for i, q in enumerate(questions):
                q["order_index"] = i + 1
                if "type" not in q:
                    q["type"] = "TECHNICAL"
            logger.info(f"Generated {len(questions)} questions for interview {interview_id}")
        except Exception as exc:
            logger.error(f"Question generation failed for interview {interview_id}: {exc}")
            # Robust fallback — always works even if Gemini is down
            jt = interview.job_title
            questions = [
                {"text": f"Tell me about your background and experience as a {jt}.", "type": "BEHAVIORAL", "order_index": 1},
                {"text": f"What are the core technical skills required for a {jt} role?", "type": "TECHNICAL", "order_index": 2},
                {"text": "Describe a challenging project you worked on and how you solved it.", "type": "BEHAVIORAL", "order_index": 3},
                {"text": "How do you approach debugging a complex issue in production?", "type": "SITUATIONAL", "order_index": 4},
                {"text": "What development tools and workflows do you use daily?", "type": "TECHNICAL", "order_index": 5},
                {"text": "How do you handle disagreements with teammates about technical decisions?", "type": "BEHAVIORAL", "order_index": 6},
                {"text": "Walk me through how you would design a scalable system from scratch.", "type": "TECHNICAL", "order_index": 7},
                {"text": "Describe a time you had to learn a new technology quickly.", "type": "BEHAVIORAL", "order_index": 8},
                {"text": "How do you prioritise tasks when working under tight deadlines?", "type": "SITUATIONAL", "order_index": 9},
                {"text": "What motivates you in your work and where do you see yourself in 3 years?", "type": "BEHAVIORAL", "order_index": 10},
            ]
            questions = questions[:interview.total_questions]

        # Save questions to DB
        saved_questions = []
        for q in questions:
            saved_q = await self.repo.add_question(
                db,
                interview_id=interview_id,
                text=q["text"],
                order_index=q.get("order_index", 1),
                question_type=q.get("type", "TECHNICAL"),
            )
            saved_questions.append(saved_q)

        await self.repo.update_status(db, interview_id, "ACTIVE")
        await db.commit()
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
