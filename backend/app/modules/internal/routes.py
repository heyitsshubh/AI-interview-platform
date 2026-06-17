"""
Internal API routes — called exclusively by the BullMQ Node.js worker.
Protected by INTERNAL_API_KEY header, NOT exposed to public users.
"""
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/internal", tags=["Internal Worker API"])
settings = get_settings()


def verify_internal_key(x_internal_key: str = Header(..., alias="X-Internal-Key")):
    """Validate internal API key sent by the Node.js worker."""
    if x_internal_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key",
        )
    return True


# ─── Resume Internal Endpoints ────────────────────────────────────────────────

class ResumeStatusUpdate(BaseModel):
    status: str
    extracted_text: str | None = None
    embedding_path: str | None = None


@router.patch("/resumes/{resume_id}/status")
async def update_resume_status(
    resume_id: uuid.UUID,
    data: ResumeStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Update resume processing status. Called by resume worker."""
    from app.modules.resumes.service import ResumeService
    service = ResumeService()
    resume = await service.update_resume_status(
        db, resume_id, data.status, data.extracted_text, data.embedding_path
    )
    return {"id": str(resume.id), "status": resume.status}


@router.post("/resumes/{resume_id}/extract-text")
async def extract_resume_text(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Extract text from PDF and update resume. Called by resume worker."""
    from sqlalchemy import select
    from app.modules.resumes.model import Resume
    from app.modules.resumes.parser import extract_text_from_pdf

    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    try:
        text = extract_text_from_pdf(resume.file_path)
        resume.extracted_text = text
        resume.status = "PROCESSING"
        await db.flush()
        await db.commit()
        return {"resume_id": str(resume_id), "text_length": len(text), "status": "PROCESSING"}
    except Exception as exc:
        logger.error(f"Text extraction failed for resume {resume_id}: {exc}")
        resume.status = "FAILED"
        await db.flush()
        await db.commit()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/resumes/{resume_id}/generate-embeddings")
async def generate_resume_embeddings(
    resume_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Generate FAISS embeddings for a resume. Called by resume worker."""
    from sqlalchemy import select
    from app.modules.resumes.model import Resume
    from app.ai.rag.vectorstore import FAISSVectorStore

    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not resume.extracted_text:
        raise HTTPException(status_code=400, detail="Resume has no extracted text. Run extract-text first.")

    try:
        # Bypassing embeddings since Gemini 1.5 Flash's 1M context window makes RAG unnecessary for single resumes
        resume.embedding_path = "bypassed"
        resume.status = "DONE"
        await db.flush()
        await db.commit()
        return {"resume_id": str(resume_id), "embedding_path": "bypassed", "status": "DONE"}
    except Exception as exc:
        logger.error(f"Embedding generation failed for resume {resume_id}: {exc}")
        resume.status = "FAILED"
        await db.flush()
        await db.commit()
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Interview Internal Endpoints ─────────────────────────────────────────────

@router.get("/interviews/{interview_id}/full-data")
async def get_interview_full_data(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Get complete interview data including questions and answers. For worker."""
    from sqlalchemy import select
    from app.modules.interviews.model import Interview, Question, Answer
    from app.modules.interviews.repository import InterviewRepository
    from app.modules.resumes.model import Resume

    repo = InterviewRepository()
    interview = await repo.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    questions = await repo.get_questions(db, interview_id)
    answers = await repo.get_answers(db, interview_id)

    resume_text = ""
    if interview.resume_id:
        result = await db.execute(select(Resume).where(Resume.id == interview.resume_id))
        resume = result.scalar_one_or_none()
        if resume:
            resume_text = resume.extracted_text or ""

    return {
        "interview_id": str(interview_id),
        "job_title": interview.job_title,
        "job_description": interview.job_description,
        "status": interview.status,
        "resume_text": resume_text,
        "questions": [
            {
                "id": str(q.id),
                "text": q.text,
                "order_index": q.order_index,
                "question_type": q.question_type,
            }
            for q in questions
        ],
        "answers": [
            {
                "id": str(a.id),
                "question_id": str(a.question_id),
                "text": a.text or "",
                "audio_path": a.audio_path,
            }
            for a in answers
        ],
    }


@router.post("/interviews/{interview_id}/run-evaluation")
async def run_interview_evaluation(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """
    Run the full AI evaluation pipeline for a completed interview.
    Called by the BullMQ evaluation worker.
    """
    from app.modules.cheating.service import CheatingService
    from app.modules.interviews.repository import InterviewRepository
    from app.ai.agents.graph import run_evaluation_pipeline

    repo = InterviewRepository()
    cheating_svc = CheatingService()

    # Get full data
    interview_data_response = await get_interview_full_data(interview_id, db, True)

    # Get cheating report
    cheating_report_obj = await cheating_svc.get_cheating_report(db, interview_id)
    cheating_report = {
        "total_events": cheating_report_obj.total_events,
        "by_category": cheating_report_obj.by_category,
        "by_severity": cheating_report_obj.by_severity,
        "integrity_score": cheating_report_obj.integrity_score,
        "risk_level": cheating_report_obj.risk_level,
    }

    # Update report status to GENERATING
    db_report = await repo.get_report(db, interview_id)
    if db_report:
        await repo.update_report(db, db_report.id, status="GENERATING")

    try:
        result = await run_evaluation_pipeline({
            **interview_data_response,
            "cheating_report": cheating_report,
        })

        scores = result.get("scores", {})
        if db_report:
            await repo.update_report(
                db, db_report.id,
                status="DONE",
                file_path=result.get("report_path"),
                overall_score=scores.get("overall_score"),
                technical_score=scores.get("technical_score"),
                communication_score=scores.get("communication_score"),
                integrity_score=scores.get("integrity_score"),
                recommendation=result.get("recommendation"),
                feedback_json={
                    "narrative": result.get("feedback_narrative"),
                    "scores": scores,
                    "evaluated_answers": result.get("evaluated_answers", []),
                },
            )

        # Update individual answer scores
        for eval_answer in result.get("evaluated_answers", []):
            try:
                answer_id = uuid.UUID(eval_answer.get("answer_id", ""))
                await repo.update_answer_score(
                    db, answer_id,
                    score=eval_answer.get("score", 0.0),
                    feedback=eval_answer.get("feedback", ""),
                )
            except Exception:
                pass

        return {
            "interview_id": str(interview_id),
            "status": "DONE",
            "report_path": result.get("report_path"),
            "overall_score": scores.get("overall_score"),
            "recommendation": result.get("recommendation"),
        }

    except Exception as exc:
        logger.error(f"Evaluation pipeline failed for {interview_id}: {exc}")
        if db_report:
            await repo.update_report(db, db_report.id, status="FAILED")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/reports/{interview_id}")
async def save_report_data(
    interview_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Save report data from worker. Backup endpoint."""
    from app.modules.interviews.repository import InterviewRepository

    repo = InterviewRepository()
    report = await repo.get_report(db, interview_id)
    if report:
        await repo.update_report(db, report.id, **data)
    return {"status": "ok"}


# ─── User Internal Endpoints ──────────────────────────────────────────────────

@router.get("/users/{user_id}/email")
async def get_user_email(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Get user email for notification. Called by email worker."""
    from app.modules.auth.repository import AuthRepository

    repo = AuthRepository()
    user = await repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": str(user_id),
        "email": user.email,
        "full_name": user.full_name,
    }


# ─── Cheating Internal Endpoints ──────────────────────────────────────────────

@router.get("/cheating/{interview_id}/report")
async def get_cheating_report_internal(
    interview_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(verify_internal_key),
):
    """Get cheating report for worker use."""
    from app.modules.cheating.service import CheatingService

    svc = CheatingService()
    report = await svc.get_cheating_report(db, interview_id)
    return report.model_dump()
