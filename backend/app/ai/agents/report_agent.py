"""
Report Generation Agent (LangGraph Node)
Generates comprehensive PDF interview reports using Gemini + ReportLab.
"""
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _determine_recommendation(overall_score: float, integrity_score: float, risk_level: str) -> str:
    """Determine hiring recommendation based on scores."""
    if risk_level == "CRITICAL":
        return "REJECT"
    if overall_score >= 8.0 and integrity_score >= 8.0:
        return "STRONG_HIRE"
    if overall_score >= 6.5 and integrity_score >= 6.0:
        return "HIRE"
    if overall_score >= 5.0:
        return "MAYBE"
    return "REJECT"


async def _generate_feedback_narrative(
    llm,
    job_title: str,
    scores: dict,
    evaluated_answers: list,
    resume_analysis: dict,
    cheating_report: dict,
    recommendation: str,
) -> str:
    """Use Gemini to generate a comprehensive feedback narrative."""
    from langchain_core.messages import HumanMessage, SystemMessage

    cheating_summary = ""
    if cheating_report.get("total_events", 0) > 0:
        cheating_summary = f"""
Integrity Issues Detected:
- Total cheating events: {cheating_report.get('total_events', 0)}
- Risk Level: {cheating_report.get('risk_level', 'UNKNOWN')}
- Categories: {json.dumps(cheating_report.get('by_category', {}), indent=2)}
"""

    user_prompt = f"""Write a comprehensive, professional interview evaluation report for a {job_title} candidate.

SCORES:
- Overall Score: {scores.get('overall_score', 0)}/10
- Technical Score: {scores.get('technical_score', 0)}/10
- Communication Score: {scores.get('communication_score', 0)}/10
- Integrity Score: {scores.get('integrity_score', 0)}/10

CANDIDATE BACKGROUND:
- Experience: {resume_analysis.get('years_of_experience', 0)} years
- Key Skills: {', '.join(resume_analysis.get('skills', [])[:8])}
- Education: {json.dumps(resume_analysis.get('education', []))}

RECOMMENDATION: {recommendation}

{cheating_summary}

PERFORMANCE SUMMARY:
{json.dumps([{{'question': a.get('question_id'), 'score': a.get('score'), 'feedback': a.get('feedback')}} for a in evaluated_answers[:5]], indent=2)}

Write a structured narrative with these sections:
1. Executive Summary (2-3 sentences)
2. Technical Competency Assessment
3. Communication & Behavioral Assessment
4. Strengths (3-5 bullet points)
5. Areas for Improvement (2-4 bullet points)
{f'6. Integrity Concerns (mandatory given the detected incidents)' if cheating_report.get('total_events', 0) > 0 else ''}
7. Final Recommendation with justification

Keep it professional, specific, and actionable. Write in third person."""

    response = await llm.ainvoke([
        SystemMessage(content="You are a senior HR professional writing official interview evaluation reports."),
        HumanMessage(content=user_prompt),
    ])
    return response.content


def _generate_pdf_report(
    report_data: dict,
    output_path: str,
) -> None:
    """Generate a professional PDF report using ReportLab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    # Color palette
    PRIMARY = colors.HexColor("#1a1a2e")
    ACCENT = colors.HexColor("#e94560")
    SECONDARY = colors.HexColor("#16213e")
    LIGHT_BG = colors.HexColor("#f0f4f8")
    SUCCESS = colors.HexColor("#2ecc71")
    WARNING = colors.HexColor("#f39c12")
    DANGER = colors.HexColor("#e74c3c")
    TEXT = colors.HexColor("#2d3436")

    styles = getSampleStyleSheet()
    story = []

    # ─── Header ─────────────────────────────────────────────────────────────────
    header_style = ParagraphStyle("Header", fontSize=22, textColor=colors.white,
                                   spaceAfter=4, fontName="Helvetica-Bold", alignment=TA_CENTER)
    subheader_style = ParagraphStyle("SubHeader", fontSize=12, textColor=colors.HexColor("#adb5bd"),
                                      spaceAfter=2, fontName="Helvetica", alignment=TA_CENTER)

    header_table = Table(
        [[Paragraph("🎯 AI Interview Platform", header_style)],
         [Paragraph("Interview Evaluation Report", subheader_style)]],
        colWidths=[17 * cm],
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 16),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), [8, 8, 8, 8]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.5 * cm))

    # ─── Meta info ───────────────────────────────────────────────────────────────
    meta_style = ParagraphStyle("Meta", fontSize=10, textColor=TEXT, fontName="Helvetica")
    meta_data = [
        ["Candidate:", report_data.get("candidate_name", "N/A"),
         "Date:", datetime.now().strftime("%B %d, %Y")],
        ["Position:", report_data.get("job_title", "N/A"),
         "Interview ID:", report_data.get("interview_id", "N/A")[:8] + "..."],
        ["Email:", report_data.get("email", "N/A"),
         "Experience:", f"{report_data.get('years_of_experience', 0)} years"],
    ]
    meta_table = Table(meta_data, colWidths=[3 * cm, 5.5 * cm, 2.5 * cm, 6 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.5 * cm))

    # ─── Score Summary ───────────────────────────────────────────────────────────
    scores = report_data.get("scores", {})
    recommendation = report_data.get("recommendation", "MAYBE")

    rec_colors = {
        "STRONG_HIRE": SUCCESS, "HIRE": SUCCESS,
        "MAYBE": WARNING, "REJECT": DANGER,
    }
    rec_bg = rec_colors.get(recommendation, WARNING)

    section_title = ParagraphStyle("SectionTitle", fontSize=13, textColor=PRIMARY,
                                    fontName="Helvetica-Bold", spaceAfter=8, spaceBefore=12)
    story.append(Paragraph("Score Summary", section_title))

    score_data = [
        ["Metric", "Score", "Rating"],
        ["Overall Score", f"{scores.get('overall_score', 0):.1f} / 10.0",
         "⭐" * int(round(scores.get("overall_score", 0)))],
        ["Technical Score", f"{scores.get('technical_score', 0):.1f} / 10.0",
         "⭐" * int(round(scores.get("technical_score", 0)))],
        ["Communication Score", f"{scores.get('communication_score', 0):.1f} / 10.0",
         "⭐" * int(round(scores.get("communication_score", 0)))],
        ["Integrity Score", f"{scores.get('integrity_score', 0):.1f} / 10.0",
         "⭐" * int(round(scores.get("integrity_score", 0)))],
    ]
    score_table = Table(score_data, colWidths=[6 * cm, 5 * cm, 6 * cm])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SECONDARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(score_table)

    # Recommendation badge
    rec_table = Table(
        [[Paragraph(f"RECOMMENDATION: {recommendation}", ParagraphStyle(
            "Rec", fontSize=14, textColor=colors.white, fontName="Helvetica-Bold", alignment=TA_CENTER
        ))]],
        colWidths=[17 * cm],
    )
    rec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), rec_bg),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), [4, 4, 4, 4]),
    ]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(rec_table)
    story.append(Spacer(1, 0.5 * cm))

    # ─── Cheating Detection Section ───────────────────────────────────────────────
    cheating_report = report_data.get("cheating_report", {})
    total_cheating = cheating_report.get("total_events", 0)

    if total_cheating > 0:
        story.append(Paragraph("⚠️ Integrity Assessment", section_title))

        risk_level = cheating_report.get("risk_level", "UNKNOWN")
        risk_bg = {"LOW": SUCCESS, "MEDIUM": WARNING, "HIGH": DANGER, "CRITICAL": DANGER}.get(risk_level, WARNING)

        cheat_header = Table(
            [[Paragraph(f"Risk Level: {risk_level} | Total Incidents: {total_cheating}", ParagraphStyle(
                "CheatHdr", fontSize=11, textColor=colors.white, fontName="Helvetica-Bold"
            ))]],
            colWidths=[17 * cm],
        )
        cheat_header.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), risk_bg),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(cheat_header)

        by_category = cheating_report.get("by_category", {})
        if by_category:
            cat_data = [["Cheating Category", "Occurrences", "Severity"]]
            category_severity_map = {
                "TAB_SWITCH": "MEDIUM", "WINDOW_BLUR": "LOW", "COPY_PASTE": "MEDIUM",
                "MULTIPLE_FACES": "HIGH", "NO_FACE": "MEDIUM", "LOOKING_AWAY": "LOW",
                "EXTERNAL_VOICE": "MEDIUM", "SCREEN_SHARE": "HIGH",
                "DEVTOOLS_OPEN": "HIGH", "KEYBOARD_MISMATCH": "HIGH",
            }
            for cat, count in by_category.items():
                severity = category_severity_map.get(cat, "MEDIUM")
                cat_data.append([cat.replace("_", " "), str(count), severity])

            cat_table = Table(cat_data, colWidths=[7 * cm, 4 * cm, 6 * cm])
            cat_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), DANGER),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fff5f5")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]))
            story.append(Spacer(1, 0.2 * cm))
            story.append(cat_table)
        story.append(Spacer(1, 0.5 * cm))

    # ─── Detailed Feedback Narrative ─────────────────────────────────────────────
    feedback_style = ParagraphStyle("Feedback", fontSize=10, textColor=TEXT,
                                     fontName="Helvetica", leading=16, alignment=TA_JUSTIFY)

    narrative = report_data.get("feedback_narrative", "")
    if narrative:
        story.append(Paragraph("Detailed Evaluation", section_title))
        # Split into paragraphs
        for para in narrative.split("\n\n"):
            para = para.strip()
            if para:
                if para.startswith(("#", "**", "##")):
                    # Section header
                    clean = para.lstrip("#").strip().strip("*")
                    story.append(Paragraph(clean, ParagraphStyle(
                        "SubSec", fontSize=11, fontName="Helvetica-Bold",
                        textColor=SECONDARY, spaceBefore=10, spaceAfter=4
                    )))
                else:
                    story.append(Paragraph(para, feedback_style))
                    story.append(Spacer(1, 0.2 * cm))

    # ─── Per-Question Breakdown ───────────────────────────────────────────────────
    evaluated_answers = report_data.get("evaluated_answers", [])
    if evaluated_answers:
        story.append(Paragraph("Per-Question Analysis", section_title))

        for i, ans in enumerate(evaluated_answers, 1):
            score = ans.get("score", 0)
            score_color = SUCCESS if score >= 7 else (WARNING if score >= 5 else DANGER)

            q_data = [
                [Paragraph(f"Q{i}: Score {score:.1f}/10", ParagraphStyle(
                    "QH", fontSize=10, fontName="Helvetica-Bold", textColor=colors.white
                ))],
                [Paragraph(ans.get("feedback", "No feedback available."), ParagraphStyle(
                    "QF", fontSize=9, fontName="Helvetica", textColor=TEXT, leading=14
                ))],
            ]
            q_table = Table(q_data, colWidths=[17 * cm])
            q_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), score_color),
                ("BACKGROUND", (0, 1), (-1, -1), LIGHT_BG),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#dee2e6")),
            ]))
            story.append(q_table)
            story.append(Spacer(1, 0.2 * cm))

    # ─── Footer ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dee2e6")))
    story.append(Paragraph(
        f"Generated by AI Interview Platform • {datetime.now().strftime('%Y-%m-%d %H:%M')} UTC • Confidential",
        ParagraphStyle("Footer", fontSize=8, textColor=colors.grey, alignment=TA_CENTER, spaceBefore=8),
    ))

    doc.build(story)
    logger.info(f"PDF report generated: {output_path}")


async def generate_report_node(state: dict[str, Any]) -> dict[str, Any]:
    """
    LangGraph node: Generate comprehensive feedback narrative and PDF report.

    Input state keys: evaluated_answers, scores, resume_analysis, job_title,
                      cheating_report, interview_id
    Output state keys: report_path, feedback_narrative, recommendation
    """
    from langchain_google_genai import ChatGoogleGenerativeAI
    from app.core.config import get_settings

    settings = get_settings()
    evaluated_answers = state.get("evaluated_answers", [])
    scores = state.get("scores", {})
    resume_analysis = state.get("resume_analysis", {})
    job_title = state.get("job_title", "Software Engineer")
    cheating_report = state.get("cheating_report", {})
    interview_id = state.get("interview_id", str(uuid.uuid4()))

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=settings.GEMINI_API_KEY,
        temperature=0.2,
    )

    recommendation = _determine_recommendation(
        overall_score=scores.get("overall_score", 0),
        integrity_score=scores.get("integrity_score", 10),
        risk_level=cheating_report.get("risk_level", "LOW"),
    )

    # Generate narrative
    try:
        feedback_narrative = await _generate_feedback_narrative(
            llm=llm,
            job_title=job_title,
            scores=scores,
            evaluated_answers=evaluated_answers,
            resume_analysis=resume_analysis,
            cheating_report=cheating_report,
            recommendation=recommendation,
        )
    except Exception as exc:
        logger.error(f"Narrative generation failed: {exc}")
        feedback_narrative = f"Interview evaluation for {job_title} position. Overall score: {scores.get('overall_score', 0)}/10. Recommendation: {recommendation}."

    # Build report directory
    report_dir = Path(settings.STORAGE_PATH) / "reports" / str(interview_id)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = str(report_dir / "report.pdf")

    # Generate PDF
    report_data = {
        "interview_id": interview_id,
        "job_title": job_title,
        "candidate_name": resume_analysis.get("candidate_name", "Candidate"),
        "email": resume_analysis.get("email", ""),
        "years_of_experience": resume_analysis.get("years_of_experience", 0),
        "scores": scores,
        "recommendation": recommendation,
        "cheating_report": cheating_report,
        "evaluated_answers": evaluated_answers,
        "feedback_narrative": feedback_narrative,
    }

    try:
        _generate_pdf_report(report_data, report_path)
    except Exception as exc:
        logger.error(f"PDF generation failed: {exc}")
        report_path = ""

    logger.info(f"Report node complete. Recommendation: {recommendation}")
    return {
        **state,
        "report_path": report_path,
        "feedback_narrative": feedback_narrative,
        "recommendation": recommendation,
    }
