"""
Cheating detection service.
"""
import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.modules.cheating.model import (
    CheatingEvent,
    CheatingCategory,
    SeverityLevel,
    SEVERITY_PENALTIES,
    CATEGORY_DEFAULT_SEVERITY,
)
from app.modules.cheating.schema import CheatingEventCreate, CheatingReport, CheatingEventResponse

logger = logging.getLogger(__name__)


class CheatingService:
    async def report_event(
        self,
        db: AsyncSession,
        interview_id: uuid.UUID,
        user_id: uuid.UUID,
        event_data: CheatingEventCreate,
    ) -> CheatingEvent:
        """Record a cheating event in the database."""
        # Use default severity if HIGH-risk category
        severity = event_data.severity or CATEGORY_DEFAULT_SEVERITY.get(
            event_data.category, SeverityLevel.MEDIUM
        )

        event = CheatingEvent(
            interview_id=interview_id,
            user_id=user_id,
            category=event_data.category,
            severity=severity,
            description=event_data.description,
            metadata_json=event_data.metadata,
        )
        db.add(event)
        await db.flush()
        await db.refresh(event)
        logger.warning(
            f"Cheating event: interview={interview_id} user={user_id} "
            f"category={event_data.category} severity={severity}"
        )
        return event

    async def get_events(self, db: AsyncSession, interview_id: uuid.UUID) -> list[CheatingEvent]:
        """Get all cheating events for an interview."""
        result = await db.execute(
            select(CheatingEvent)
            .where(CheatingEvent.interview_id == interview_id)
            .order_by(CheatingEvent.created_at)
        )
        return result.scalars().all()

    async def get_cheating_report(self, db: AsyncSession, interview_id: uuid.UUID) -> CheatingReport:
        """Aggregate cheating events into a comprehensive report."""
        events = await self.get_events(db, interview_id)

        by_category: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        total_penalty = 0

        for event in events:
            # Count by category
            cat_key = str(event.category)
            sev_key = str(event.severity)
            by_category[cat_key] = by_category.get(cat_key, 0) + 1
            # Count by severity
            by_severity[sev_key] = by_severity.get(sev_key, 0) + 1
            # Calculate penalty
            penalty = SEVERITY_PENALTIES.get(event.severity, 5)
            total_penalty += penalty

        integrity_score = max(0.0, 100.0 - total_penalty)

        # Determine risk level
        if integrity_score >= 90:
            risk_level = "LOW"
        elif integrity_score >= 70:
            risk_level = "MEDIUM"
        elif integrity_score >= 50:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        event_responses = [
            CheatingEventResponse.model_validate(e) for e in events
        ]

        return CheatingReport(
            interview_id=interview_id,
            total_events=len(events),
            by_category=by_category,
            by_severity=by_severity,
            integrity_score=integrity_score,
            events=event_responses,
            risk_level=risk_level,
        )
