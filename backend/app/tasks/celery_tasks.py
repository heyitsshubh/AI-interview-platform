"""
Celery tasks for the AI Interview Platform.
"""

import uuid
import logging
import asyncio
from celery import shared_task
from sqlalchemy import select

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)

async def _generate_interview_questions_async(interview_id_str: str):
    from app.core.database import AsyncSessionLocal
    from app.modules.resumes.model import Resume
    from app.modules.interviews.repository import InterviewRepository
    from app.modules.interviews.model import Interview, Question
    import json as json_mod
    import re
    from langchain_google_genai import ChatGoogleGenerativeAI, HarmCategory, HarmBlockThreshold
    from langchain_core.messages import HumanMessage
    from app.core.config import get_settings

    interview_id = uuid.UUID(interview_id_str)
    
    try:
        async with AsyncSessionLocal() as db:
            repo = InterviewRepository()
            interview = await repo.get_interview(db, interview_id)
            if not interview:
                logger.error(f"Interview {interview_id} not found in background task.")
                return

            # Check if questions already exist
            existing_q = await db.execute(select(Question).where(Question.interview_id == interview_id))
            if existing_q.scalars().first():
                logger.info(f"Questions already exist for {interview_id}")
                await repo.update_status(db, interview_id, "ACTIVE")
                await db.commit()
                return

            resume_text = ""
            if interview.resume_id:
                result = await db.execute(select(Resume).where(Resume.id == interview.resume_id))
                resume = result.scalar_one_or_none()
                if resume and resume.extracted_text:
                    resume_text = resume.extracted_text

            # Generate questions using Gemini
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
            
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                content = match.group(0)
                
            questions = json_mod.loads(content)
            
            for i, q in enumerate(questions):
                q["order_index"] = i + 1
                if "type" not in q:
                    q["type"] = "TECHNICAL"
            
            # Save questions
            for q in questions:
                await repo.add_question(
                    db,
                    interview_id=interview_id,
                    text=q["text"],
                    order_index=q.get("order_index", 1),
                    question_type=q.get("type", "TECHNICAL"),
                )
                
            await repo.update_status(db, interview_id, "ACTIVE")
            await db.commit()
            logger.info(f"Celery generation completed for interview {interview_id}")
            
    except Exception as exc:
        logger.error(f"Celery question generation failed for {interview_id_str}: {exc}")
        # In a real app we might set status to FAILED or save fallback questions
        # For robustness, we will save fallback questions here:
        try:
            async with AsyncSessionLocal() as db:
                repo = InterviewRepository()
                interview = await repo.get_interview(db, interview_id)
                if not interview:
                    return
                jt = interview.job_title
                fallback_questions = [
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
                fallback_questions = fallback_questions[:interview.total_questions]
                for q in fallback_questions:
                    await repo.add_question(db, interview_id=interview_id, text=q["text"], order_index=q["order_index"], question_type=q["type"])
                await repo.update_status(db, interview_id, "ACTIVE")
                await db.commit()
                logger.info(f"Saved fallback questions for {interview_id}")
        except Exception as fallback_exc:
            logger.error(f"Failed to save fallback questions: {fallback_exc}")


@celery_app.task(name="generate_questions_task")
def generate_questions_task(interview_id_str: str):
    """
    Synchronous Celery task wrapper that runs the async generation logic.
    """
    logger.info(f"Starting Celery task generate_questions_task for {interview_id_str}")
    # Create a new event loop for this synchronous thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_generate_interview_questions_async(interview_id_str))
    finally:
        loop.close()
