"""
Cheating detection API routes.
"""
import uuid
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user, require_role
from app.modules.cheating.service import CheatingService
from app.modules.cheating.schema import CheatingEventCreate, CheatingEventResponse, CheatingReport

router = APIRouter(prefix="/api/cheating", tags=["Cheating Detection"])
_service = CheatingService()
logger = logging.getLogger(__name__)


@router.post(
    "/{interview_id}/event",
    response_model=CheatingEventResponse,
    status_code=201,
)
async def report_cheating_event(
    interview_id: uuid.UUID,
    event_data: CheatingEventCreate,
    current_user=Depends(require_role("CANDIDATE")),
    db: AsyncSession = Depends(get_db),
):
    """
    Report a cheating event during an interview.
    Called by client-side monitoring (tab switch, face detection, etc.).
    CANDIDATE only.
    """
    event = await _service.report_event(
        db=db,
        interview_id=interview_id,
        user_id=current_user.id,
        event_data=event_data,
    )
    return CheatingEventResponse.model_validate(event)


@router.get(
    "/{interview_id}/report",
    response_model=CheatingReport,
)
async def get_cheating_report(
    interview_id: uuid.UUID,
    current_user=Depends(require_role("RECRUITER")),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the full cheating/integrity report for an interview.
    RECRUITER only.
    Returns aggregated event counts, integrity score (0-100), and risk level.
    """
    report = await _service.get_cheating_report(db=db, interview_id=interview_id)
    return report


@router.get(
    "/{interview_id}/events",
    response_model=list[CheatingEventResponse],
)
async def list_cheating_events(
    interview_id: uuid.UUID,
    current_user=Depends(require_role("RECRUITER")),
    db: AsyncSession = Depends(get_db),
):
    """
    List all individual cheating events for an interview.
    RECRUITER only.
    """
    events = await _service.get_events(db=db, interview_id=interview_id)
    return [CheatingEventResponse.model_validate(e) for e in events]
