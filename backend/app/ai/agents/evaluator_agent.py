"""
Answer Evaluation Agent (LangGraph Node)
Scores interview answers using Google Gemini with cheating penalty integration.
"""
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def evaluate_answers_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node: Score each answer and compute aggregate interview scores.

    Input state keys: questions, answers, resume_analysis, job_title, cheating_report
    Output state keys: evaluated_answers, scores
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage, SystemMessage
    from app.core.config import get_settings

    settings = get_settings()
    questions = state.get("questions", [])
    answers = state.get("answers", [])
    resume_analysis = state.get("resume_analysis", {})
    job_title = state.get("job_title", "Software Engineer")
    cheating_report = state.get("cheating_report", {})

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.3,
    )

    # Build question-answer pairs
    qa_pairs = []
    for answer in answers:
        question = next(
            (q for q in questions if str(q.get("id", "")) == str(answer.get("question_id", ""))),
            None,
        )
        if question:
            qa_pairs.append({
                "question_id": str(answer.get("question_id", "")),
                "answer_id": str(answer.get("id", "")),
                "question": question.get("text", ""),
                "question_type": question.get("question_type", "TECHNICAL"),
                "expected_keywords": question.get("expected_keywords", []),
                "difficulty": question.get("difficulty", "MEDIUM"),
                "answer": answer.get("text") or "[No answer provided]",
            })

    evaluated_answers = []
    technical_scores = []
    behavioral_scores = []

    system_prompt = """You are an expert AI interviewer and evaluator. Score interview answers objectively.
    Consider clarity, depth, relevance, and technical accuracy. Be fair but demanding."""

    for pair in qa_pairs:
        user_prompt = f"""Evaluate this interview answer for a {job_title} position.

Question ({pair['question_type']}): {pair['question']}
Expected Keywords/Concepts: {', '.join(pair['expected_keywords']) if pair['expected_keywords'] else 'General competency'}
Difficulty: {pair['difficulty']}

Candidate's Answer: "{pair['answer']}"

Candidate Background: {resume_analysis.get('years_of_experience', 0)} years experience, 
Skills: {', '.join(resume_analysis.get('skills', [])[:5])}

Score this answer from 0.0 to 10.0 and return ONLY valid JSON:
{{
  "score": 7.5,
  "feedback": "Specific constructive feedback in 2-3 sentences",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "keywords_matched": ["keyword1"],
  "keywords_missing": ["keyword2"]
}}

Scoring Guide:
- 9-10: Exceptional answer demonstrating expert-level understanding
- 7-8: Good answer with clear understanding and relevant examples
- 5-6: Average answer, correct but lacking depth or specificity
- 3-4: Below average, partially correct or vague
- 0-2: Incorrect, irrelevant, or no meaningful response
- For "[No answer provided]": score 0.0"""

        try:
            response = await llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ])

            content = response.content.strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()

            eval_result = json.loads(content)
            score = float(eval_result.get("score", 5.0))

        except Exception as exc:
            logger.error(f"Answer evaluation error for question {pair.get('question_id')}: {exc}")
            eval_result = {
                "score": 5.0,
                "feedback": "Evaluation could not be completed.",
                "strengths": [],
                "improvements": [],
            }
            score = 5.0

        evaluated_answer = {
            "question_id": pair["question_id"],
            "answer_id": pair["answer_id"],
            "score": score,
            "feedback": eval_result.get("feedback", ""),
            "strengths": eval_result.get("strengths", []),
            "improvements": eval_result.get("improvements", []),
            "keywords_matched": eval_result.get("keywords_matched", []),
            "keywords_missing": eval_result.get("keywords_missing", []),
        }
        evaluated_answers.append(evaluated_answer)

        if pair["question_type"] == "TECHNICAL":
            technical_scores.append(score)
        else:
            behavioral_scores.append(score)

    # Calculate aggregate scores
    all_scores = [a["score"] for a in evaluated_answers]
    technical_avg = sum(technical_scores) / len(technical_scores) if technical_scores else 0.0
    behavioral_avg = sum(behavioral_scores) / len(behavioral_scores) if behavioral_scores else 0.0
    overall_raw = sum(all_scores) / len(all_scores) if all_scores else 0.0

    # Apply integrity penalty from cheating detection
    integrity_score = cheating_report.get("integrity_score", 100.0)
    integrity_penalty = (100.0 - integrity_score) / 100.0  # 0 to 1
    overall_adjusted = overall_raw * (1.0 - integrity_penalty * 0.3)  # Max 30% reduction

    # Communication score based on answer lengths and coherence (proxy metric)
    avg_answer_length = 0
    if answers:
        avg_answer_length = sum(len(a.get("text") or "") for a in answers) / len(answers)
    communication_score = min(10.0, max(0.0, avg_answer_length / 50))

    scores = {
        "overall_score": round(overall_adjusted, 2),
        "technical_score": round(technical_avg, 2),
        "communication_score": round(communication_score, 2),
        "integrity_score": round(integrity_score / 10, 2),  # Convert to 0-10 scale
        "raw_score": round(overall_raw, 2),
        "total_answers": len(evaluated_answers),
    }

    logger.info(f"Evaluation complete. Overall score: {scores['overall_score']}/10")
    return {**state, "evaluated_answers": evaluated_answers, "scores": scores}
