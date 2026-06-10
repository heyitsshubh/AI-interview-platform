"""
LangGraph StateGraph: AI Interview Pipeline
Composes Resume → Interview → Evaluator → Report agents into a unified graph.
"""
import logging
from typing import Any, TypedDict

from langgraph.graph import StateGraph, START, END

from app.ai.agents.resume_agent import resume_analysis_node
from app.ai.agents.interview_agent import generate_questions_node
from app.ai.agents.evaluator_agent import evaluate_answers_node
from app.ai.agents.report_agent import generate_report_node

logger = logging.getLogger(__name__)


class InterviewState(TypedDict, total=False):
    """Shared state passed between all LangGraph nodes."""
    # Input
    resume_text: str
    job_title: str
    total_questions: int
    interview_id: str

    # After resume_analysis_node
    resume_analysis: dict

    # After generate_questions_node
    questions: list[dict]

    # For evaluation
    answers: list[dict]
    cheating_report: dict

    # After evaluate_answers_node
    evaluated_answers: list[dict]
    scores: dict

    # After generate_report_node
    report_path: str
    feedback_narrative: str
    recommendation: str


# ─── Build full pipeline graph ────────────────────────────────────────────────

def _build_full_pipeline() -> StateGraph:
    """Full pipeline: Resume → Questions → Evaluate → Report."""
    graph = StateGraph(InterviewState)

    graph.add_node("resume_analysis", resume_analysis_node)
    graph.add_node("generate_questions", generate_questions_node)
    graph.add_node("evaluate_answers", evaluate_answers_node)
    graph.add_node("generate_report", generate_report_node)

    graph.add_edge(START, "resume_analysis")
    graph.add_edge("resume_analysis", "generate_questions")
    graph.add_edge("generate_questions", "evaluate_answers")
    graph.add_edge("evaluate_answers", "generate_report")
    graph.add_edge("generate_report", END)

    return graph.compile()


# ─── Build question-only graph ────────────────────────────────────────────────

def _build_question_graph() -> StateGraph:
    """Lighter graph: Resume → Questions only (used when starting interview)."""
    graph = StateGraph(InterviewState)

    graph.add_node("resume_analysis", resume_analysis_node)
    graph.add_node("generate_questions", generate_questions_node)

    graph.add_edge(START, "resume_analysis")
    graph.add_edge("resume_analysis", "generate_questions")
    graph.add_edge("generate_questions", END)

    return graph.compile()


# ─── Build evaluation-only graph ─────────────────────────────────────────────

def _build_evaluation_graph() -> StateGraph:
    """Evaluation + Report graph (used by BullMQ worker after interview)."""
    graph = StateGraph(InterviewState)

    graph.add_node("evaluate_answers", evaluate_answers_node)
    graph.add_node("generate_report", generate_report_node)

    graph.add_edge(START, "evaluate_answers")
    graph.add_edge("evaluate_answers", "generate_report")
    graph.add_edge("generate_report", END)

    return graph.compile()


# Compiled graphs (lazy init)
_full_pipeline = None
_question_graph = None
_evaluation_graph = None


def get_full_pipeline():
    global _full_pipeline
    if _full_pipeline is None:
        _full_pipeline = _build_full_pipeline()
    return _full_pipeline


def get_question_graph():
    global _question_graph
    if _question_graph is None:
        _question_graph = _build_question_graph()
    return _question_graph


def get_evaluation_graph():
    global _evaluation_graph
    if _evaluation_graph is None:
        _evaluation_graph = _build_evaluation_graph()
    return _evaluation_graph


# ─── Public API ───────────────────────────────────────────────────────────────

async def run_question_generation(
    resume_text: str,
    job_title: str,
    total_questions: int = 10,
) -> list[dict]:
    """
    Run Resume Analysis → Question Generation pipeline.
    Returns list of question dicts: [{text, type, order_index, ...}]
    """
    graph = get_question_graph()
    result = await graph.ainvoke({
        "resume_text": resume_text,
        "job_title": job_title,
        "total_questions": total_questions,
    })
    questions = result.get("questions", [])
    logger.info(f"Question generation pipeline complete: {len(questions)} questions")
    return questions


async def run_evaluation_pipeline(interview_data: dict) -> dict:
    """
    Run Evaluation → Report pipeline.

    interview_data should contain:
    - resume_text, job_title, interview_id
    - questions: list of question dicts
    - answers: list of answer dicts (with question_id, text, id)
    - cheating_report: dict from CheatingService.get_cheating_report()

    Returns: {report_path, feedback_narrative, recommendation, scores, evaluated_answers}
    """
    graph = get_evaluation_graph()

    # Resume analysis needed for report context
    resume_analysis = interview_data.get("resume_analysis")
    if resume_analysis is None:
        # Quick resume analysis if not provided
        resume_graph = get_question_graph()
        ra_result = await resume_graph.ainvoke({
            "resume_text": interview_data.get("resume_text", ""),
            "job_title": interview_data.get("job_title", ""),
            "total_questions": 1,
        })
        resume_analysis = ra_result.get("resume_analysis", {})

    result = await graph.ainvoke({
        "interview_id": interview_data.get("interview_id", ""),
        "job_title": interview_data.get("job_title", "Software Engineer"),
        "resume_analysis": resume_analysis,
        "questions": interview_data.get("questions", []),
        "answers": interview_data.get("answers", []),
        "cheating_report": interview_data.get("cheating_report", {}),
    })

    logger.info(f"Evaluation pipeline complete for interview {interview_data.get('interview_id')}")
    return result


async def run_interview_pipeline(state_input: dict) -> dict:
    """Run the full end-to-end pipeline."""
    graph = get_full_pipeline()
    result = await graph.ainvoke(state_input)
    return result
