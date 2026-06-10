"""
Report download routes.
"""
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user, require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/{interview_id}/download")
async def download_report_pdf(
    interview_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Download PDF report for an interview.
    CANDIDATE can download own report; RECRUITER can download any.
    """
    from app.modules.interviews.repository import InterviewRepository

    repo = InterviewRepository()
    interview = await repo.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

    if interview.user_id != current_user.id and "RECRUITER" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    report = await repo.get_report(db, interview_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not yet generated")

    if report.status != "DONE":
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail=f"Report is still being generated. Status: {report.status}",
        )

    if not report.file_path or not Path(report.file_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not found on disk")

    return FileResponse(
        path=report.file_path,
        media_type="application/pdf",
        filename=f"interview_report_{interview_id}.pdf",
    )


@router.get("/{interview_id}/summary")
async def get_report_summary(
    interview_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get JSON summary of the interview report."""
    from app.modules.interviews.repository import InterviewRepository

    repo = InterviewRepository()
    interview = await repo.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")

    if interview.user_id != current_user.id and "RECRUITER" not in current_user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    report = await repo.get_report(db, interview_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    return {
        "interview_id": str(interview_id),
        "status": report.status,
        "overall_score": report.overall_score,
        "technical_score": report.technical_score,
        "communication_score": report.communication_score,
        "integrity_score": report.integrity_score,
        "recommendation": report.recommendation,
        "feedback": report.feedback_json,
        "report_available": report.status == "DONE" and bool(report.file_path),
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }
