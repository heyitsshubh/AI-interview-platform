"""
PDF resume text extraction and section parsing.
"""
import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF file using pdfplumber."""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
        return "\n".join(text_parts)
    except Exception as exc:
        logger.error(f"Failed to extract text from PDF {file_path}: {exc}")
        raise RuntimeError(f"PDF extraction failed: {exc}") from exc


def extract_sections(text: str) -> dict:
    """
    Extract common resume sections using regex heuristics.
    Returns a dict with keys: skills, experience, education, summary.
    """
    sections = {
        "summary": "",
        "skills": [],
        "experience": "",
        "education": "",
        "raw_text": text,
    }

    # Section header patterns
    patterns = {
        "summary": r"(?i)(summary|objective|profile|about me)[:\s]*\n([\s\S]*?)(?=\n[A-Z][A-Z\s]{3,}[:\n]|$)",
        "skills": r"(?i)(skills|technical skills|core competencies)[:\s]*\n([\s\S]*?)(?=\n[A-Z][A-Z\s]{3,}[:\n]|$)",
        "experience": r"(?i)(experience|work experience|employment)[:\s]*\n([\s\S]*?)(?=\n[A-Z][A-Z\s]{3,}[:\n]|$)",
        "education": r"(?i)(education|academic|qualifications)[:\s]*\n([\s\S]*?)(?=\n[A-Z][A-Z\s]{3,}[:\n]|$)",
    }

    for section, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            content = match.group(2).strip()
            if section == "skills":
                # Extract as list
                skill_items = re.split(r"[,\n•\-|]+", content)
                sections["skills"] = [s.strip() for s in skill_items if s.strip() and len(s.strip()) > 1]
            else:
                sections[section] = content

    return sections


def parse_resume_file(file_path: str) -> dict:
    """Full pipeline: extract text and parse sections."""
    text = extract_text_from_pdf(file_path)
    sections = extract_sections(text)
    return {"text": text, **sections}
