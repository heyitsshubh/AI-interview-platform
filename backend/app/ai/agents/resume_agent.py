"""
Resume Analysis Agent (LangGraph Node)
Analyzes resume text and extracts structured information using Google Gemini.
"""
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def resume_analysis_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node: Analyze resume text using Gemini and extract structured data.

    Input state keys: resume_text, job_title
    Output state keys: resume_analysis
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage, SystemMessage
    from app.core.config import get_settings

    settings = get_settings()
    resume_text = state.get("resume_text", "")
    job_title = state.get("job_title", "Software Engineer")

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.1,
    )

    system_prompt = """You are an expert HR analyst and resume parser. 
    Analyze the provided resume and extract structured information as valid JSON.
    Be precise, objective, and thorough in your analysis."""

    user_prompt = f"""Analyze this resume for a {job_title} position and return ONLY a valid JSON object with this exact structure:

{{
  "candidate_name": "full name extracted from resume",
  "email": "email if found",
  "phone": "phone if found",
  "years_of_experience": 5,
  "current_role": "most recent job title",
  "skills": ["skill1", "skill2", "skill3"],
  "technical_skills": ["tech1", "tech2"],
  "soft_skills": ["leadership", "communication"],
  "education": [
    {{"degree": "B.Sc Computer Science", "institution": "MIT", "year": 2019}}
  ],
  "previous_roles": [
    {{"title": "Software Engineer", "company": "Google", "duration": "2 years"}}
  ],
  "key_strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "relevance_score": 85,
  "summary": "2-3 sentence summary of the candidate's profile"
}}

RESUME:
{resume_text or "No resume text provided. Generate a generic analysis."}

Return ONLY the JSON object, no markdown, no explanation."""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        content = response.content.strip()
        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()

        analysis = json.loads(content)
        logger.info(f"Resume analysis complete. Relevance score: {analysis.get('relevance_score')}")
        return {**state, "resume_analysis": analysis}

    except json.JSONDecodeError as exc:
        logger.error(f"Failed to parse Gemini JSON response: {exc}")
        # Return fallback analysis
        return {
            **state,
            "resume_analysis": {
                "candidate_name": "Unknown",
                "years_of_experience": 0,
                "skills": [],
                "technical_skills": [],
                "soft_skills": [],
                "education": [],
                "previous_roles": [],
                "key_strengths": [],
                "gaps": [],
                "relevance_score": 50,
                "summary": "Resume analysis unavailable.",
            },
        }
    except Exception as exc:
        logger.error(f"Resume agent error: {exc}")
        raise
