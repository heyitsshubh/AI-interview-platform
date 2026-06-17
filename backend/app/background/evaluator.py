"""
Background task runner for interview evaluation.
Replaces the BullMQ evaluation worker — runs directly inside the FastAPI process.
"""
import logging
import uuid

logger = logging.getLogger(__name__)


async def run_evaluation_background(interview_id: uuid.UUID):
    """
    Background task: run the full AI evaluation pipeline for a completed interview.
    Called via FastAPI BackgroundTasks after an interview session ends.
    """
    from app.core.database import AsyncSessionLocal
    from app.modules.cheating.service import CheatingService
    from app.modules.interviews.repository import InterviewRepository
    from app.ai.agents.graph import run_evaluation_pipeline

    logger.info(f"[bg-evaluator] 🚀 Starting evaluation for interview {interview_id}")

    async with AsyncSessionLocal() as db:
        try:
            repo = InterviewRepository()
            cheating_svc = CheatingService()

            # Fetch interview data
            from sqlalchemy import select
            from app.modules.interviews.model import Interview, Question, Answer
            from app.modules.resumes.model import Resume

            result = await db.execute(select(Interview).where(Interview.id == interview_id))
            interview = result.scalar_one_or_none()
            if not interview:
                logger.error(f"[bg-evaluator] Interview {interview_id} not found")
                return

            questions = await repo.get_questions(db, interview_id)
            answers = await repo.get_answers(db, interview_id)

            resume_text = ""
            if interview.resume_id:
                r = await db.execute(select(Resume).where(Resume.id == interview.resume_id))
                resume = r.scalar_one_or_none()
                if resume:
                    resume_text = resume.extracted_text or ""

            interview_data = {
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

            # Get cheating report
            try:
                cheating_report_obj = await cheating_svc.get_cheating_report(db, interview_id)
                cheating_report = {
                    "total_events": cheating_report_obj.total_events,
                    "by_category": cheating_report_obj.by_category,
                    "by_severity": cheating_report_obj.by_severity,
                    "integrity_score": cheating_report_obj.integrity_score,
                    "risk_level": cheating_report_obj.risk_level,
                }
            except Exception:
                cheating_report = {
                    "total_events": 0,
                    "by_category": {},
                    "by_severity": {},
                    "integrity_score": 100,
                    "risk_level": "LOW",
                }

            # Mark report as GENERATING
            db_report = await repo.get_report(db, interview_id)
            if db_report:
                await repo.update_report(db, db_report.id, status="GENERATING")
                await db.commit()

            # Run AI evaluation pipeline
            logger.info(f"[bg-evaluator] Running AI pipeline for interview {interview_id}")
            eval_result = await run_evaluation_pipeline({
                **interview_data,
                "cheating_report": cheating_report,
            })

            scores = eval_result.get("scores", {})

            # Save report
            if db_report:
                await repo.update_report(
                    db, db_report.id,
                    status="DONE",
                    file_path=eval_result.get("report_path"),
                    overall_score=scores.get("overall_score"),
                    technical_score=scores.get("technical_score"),
                    communication_score=scores.get("communication_score"),
                    integrity_score=scores.get("integrity_score"),
                    recommendation=eval_result.get("recommendation"),
                    feedback_json={
                        "narrative": eval_result.get("feedback_narrative"),
                        "scores": scores,
                        "evaluated_answers": eval_result.get("evaluated_answers", []),
                    },
                )
                await db.commit()

            # Save individual answer scores
            for eval_answer in eval_result.get("evaluated_answers", []):
                try:
                    answer_id = uuid.UUID(eval_answer.get("answer_id", ""))
                    await repo.update_answer_score(
                        db, answer_id,
                        score=eval_answer.get("score", 0.0),
                        feedback=eval_answer.get("feedback", ""),
                    )
                except Exception:
                    pass
            await db.commit()

            logger.info(f"[bg-evaluator] ✅ Interview {interview_id} evaluation complete. Score: {scores.get('overall_score')}")

        except Exception as exc:
            logger.error(f"[bg-evaluator] ❌ Evaluation failed for {interview_id}: {exc}", exc_info=True)
            try:
                db_report = await repo.get_report(db, interview_id)
                if db_report:
                    await repo.update_report(db, db_report.id, status="FAILED")
                    await db.commit()
            except Exception:
                pass
