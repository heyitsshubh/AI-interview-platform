"""
Interview Question Generation Agent (LangGraph Node)
Generates tailored interview questions using Google Gemini.
"""
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def generate_questions_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node: Generate interview questions based on resume analysis and job title.

    Input state keys: resume_analysis, job_title, total_questions
    Output state keys: questions
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage, SystemMessage
    from app.core.config import get_settings

    settings = get_settings()
    resume_analysis = state.get("resume_analysis", {})
    job_title = state.get("job_title", "Software Engineer")
    total_questions = state.get("total_questions", 10)

    # Calculate question distribution
    technical_count = max(1, int(total_questions * 0.4))
    behavioral_count = max(1, int(total_questions * 0.35))
    situational_count = max(1, total_questions - technical_count - behavioral_count)

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.7,
    )

    skills = resume_analysis.get("skills", [])
    experience = resume_analysis.get("years_of_experience", 0)
    strengths = resume_analysis.get("key_strengths", [])
    gaps = resume_analysis.get("gaps", [])

    system_prompt = """You are an expert technical interviewer conducting interviews for top tech companies.
    Generate thoughtful, challenging, and relevant interview questions that assess both technical ability 
    and cultural fit. Questions should be clear, specific, and answerable verbally."""

    user_prompt = f"""Generate exactly {total_questions} interview questions for a {job_title} position.

Candidate Profile:
- Skills: {', '.join(skills[:10]) if skills else 'General technical skills'}
- Years of Experience: {experience}
- Key Strengths: {', '.join(strengths[:5]) if strengths else 'Not specified'}
- Areas to Explore: {', '.join(gaps[:3]) if gaps else 'General competencies'}

Question Distribution:
- TECHNICAL questions: {technical_count} (test specific technical knowledge and problem-solving)
- BEHAVIORAL questions: {behavioral_count} (past experiences using STAR method)
- SITUATIONAL questions: {situational_count} (hypothetical scenarios)

Return ONLY a valid JSON array with exactly {total_questions} objects:
[
  {{
    "text": "Question text here?",
    "type": "TECHNICAL",
    "order_index": 1,
    "expected_keywords": ["keyword1", "keyword2"],
    "difficulty": "EASY|MEDIUM|HARD"
  }},
  ...
]

Rules:
- Questions must be answerable verbally (1-3 minutes)
- No trick questions
- Progressively increase difficulty
- Make questions specific to {job_title}
- Return ONLY the JSON array, no markdown"""

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

        questions = json.loads(content)

        # Ensure proper order_index
        for i, q in enumerate(questions):
            q["order_index"] = i + 1

        logger.info(f"Generated {len(questions)} questions for {job_title}")
        return {**state, "questions": questions}

    except Exception as exc:
        logger.error(f"Question generation error: {exc}")
        # Fallback questions
        fallback = [
            {"text": f"Can you describe your experience with {job_title} responsibilities?", "type": "BEHAVIORAL", "order_index": 1, "expected_keywords": ["experience", "role"], "difficulty": "EASY"},
            {"text": "Describe a technically challenging project you've worked on and how you solved it.", "type": "BEHAVIORAL", "order_index": 2, "expected_keywords": ["challenge", "solution", "approach"], "difficulty": "MEDIUM"},
            {"text": "How do you approach debugging a complex production issue under time pressure?", "type": "SITUATIONAL", "order_index": 3, "expected_keywords": ["debug", "systematic", "prioritize"], "difficulty": "MEDIUM"},
            {"text": "What are the core technical skills required for this role, and how do you rate yourself?", "type": "TECHNICAL", "order_index": 4, "expected_keywords": [], "difficulty": "EASY"},
            {"text": "Describe your experience with teamwork and cross-functional collaboration.", "type": "BEHAVIORAL", "order_index": 5, "expected_keywords": ["team", "collaborate", "communicate"], "difficulty": "EASY"},
        ]
        return {**state, "questions": fallback[:total_questions]}
