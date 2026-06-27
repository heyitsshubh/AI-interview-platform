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

            # Run direct Gemini evaluation to avoid LangGraph timeouts and safety blocks
            from langchain_google_genai import ChatGoogleGenerativeAI, HarmCategory, HarmBlockThreshold
            from langchain_core.messages import HumanMessage
            from app.core.config import get_settings
            import json as json_mod
            import re

            logger.info(f"[bg-evaluator] Running direct AI pipeline for interview {interview_id}")
            cfg = get_settings()

            eval_result = None

            # Try Gemini evaluation — fall back to rule-based scoring on quota/error
            try:
                llm = ChatGoogleGenerativeAI(
                    model="gemini-2.0-flash",
                    google_api_key=cfg.GEMINI_API_KEY,
                    temperature=0.3,
                    max_retries=1,
                    safety_settings={
                        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                    }
                )

                # Build QA pairs text
                qa_text = ""
                for a in interview_data["answers"]:
                    q_text = next((q["text"] for q in interview_data["questions"] if q["id"] == a["question_id"]), "Unknown Question")
                    qa_text += f"\nQ (Answer ID: {a['id']}): {q_text}\nA: {a['text']}\n"

                prompt = f"""Evaluate this interview for a {interview.job_title} position.
Candidate's Resume Text (if any): {resume_text[:2000]}

Here are the questions and candidate's answers:
{qa_text}

Provide an overall assessment and score each individual answer from 0.0 to 10.0.
Return ONLY valid JSON (no markdown fences) in this exact structure:
{{
  "recommendation": "STRONG_HIRE",
  "feedback_narrative": "A paragraph summarizing the candidate's performance...",
  "scores": {{
    "overall_score": 8.5,
    "technical_score": 8.0,
    "communication_score": 9.0
  }},
  "evaluated_answers": [
    {{
      "answer_id": "<must match the Answer ID provided above>",
      "score": 8.5,
      "feedback": "Specific feedback for this answer"
    }}
  ]
}}"""

                response = await llm.ainvoke([HumanMessage(content=prompt)])
                content = response.content.strip()
                match = re.search(r'\{.*\}', content, re.DOTALL)
                if match:
                    content = match.group(0)

                eval_result = json_mod.loads(content)
                logger.info(f"[bg-evaluator] Gemini evaluation succeeded for interview {interview_id}")

            except Exception as ai_exc:
                logger.warning(f"[bg-evaluator] Gemini unavailable ({type(ai_exc).__name__}), using rule-based scoring.")
                eval_result = None

            # Rule-based fallback scoring when AI is unavailable
            if not eval_result:
                answer_count = len(interview_data["answers"])
                base_score = min(10.0, 5.0 + answer_count * 0.3)
                fallback_answers = []
                for a in interview_data["answers"]:
                    text_len = len(a.get("text", ""))
                    score = min(10.0, 4.0 + (text_len / 100))
                    fallback_answers.append({
                        "answer_id": a["id"],
                        "score": round(score, 1),
                        "feedback": "Answer submitted successfully. AI scoring unavailable — manual review recommended."
                    })
                eval_result = {
                    "recommendation": "MAYBE",
                    "feedback_narrative": f"The candidate completed {answer_count} question(s) for the {interview.job_title} position. AI-powered scoring was unavailable — scores are estimated based on response length. A manual review is recommended.",
                    "scores": {
                        "overall_score": round(base_score, 1),
                        "technical_score": round(base_score * 0.9, 1),
                        "communication_score": round(base_score * 1.0, 1),
                    },
                    "evaluated_answers": fallback_answers,
                }
                logger.info(f"[bg-evaluator] Used rule-based fallback scoring for interview {interview_id}")

            # Apply cheating penalty
            integrity_score = cheating_report.get("integrity_score", 100.0)
            if "scores" not in eval_result:
                eval_result["scores"] = {"overall_score": 5.0, "technical_score": 5.0, "communication_score": 5.0}

            eval_result["scores"]["integrity_score"] = integrity_score / 10.0

            if integrity_score < 70:
                eval_result["recommendation"] = "REJECT"
                eval_result["scores"]["overall_score"] = eval_result["scores"].get("overall_score", 0) * 0.7

            scores = eval_result.get("scores", {})

            # Generate PDF Report
            from app.ai.agents.report_agent import _generate_pdf_report
            from pathlib import Path

            report_dir = Path(cfg.STORAGE_PATH) / "reports" / str(interview_id)
            report_dir.mkdir(parents=True, exist_ok=True)
            report_path = str(report_dir / "report.pdf")

            report_data = {
                "interview_id": interview_id,
                "job_title": interview.job_title,
                "candidate_name": "Candidate",
                "email": "",
                "years_of_experience": 0,
                "scores": scores,
                "recommendation": eval_result.get("recommendation", "MAYBE"),
                "cheating_report": cheating_report,
                "evaluated_answers": eval_result.get("evaluated_answers", []),
                "feedback_narrative": eval_result.get("feedback_narrative", ""),
            }

            try:
                _generate_pdf_report(report_data, report_path)
            except Exception as e:
                logger.error(f"Failed to generate PDF report: {e}")
                report_path = None

            # Save report
            if db_report:
                await repo.update_report(
                    db, db_report.id,
                    status="DONE",
                    file_path=report_path,
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
