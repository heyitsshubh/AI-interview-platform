"""
Cheating detection Pydantic schemas.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.modules.cheating.model import CheatingCategory, SeverityLevel


class CheatingEventCreate(BaseModel):
    interview_id: uuid.UUID
    category: CheatingCategory
    severity: SeverityLevel
    description: str | None = None
    metadata: dict | None = None


class CheatingEventResponse(BaseModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    user_id: uuid.UUID
    category: str
    severity: str
    description: str | None = None
    metadata_json: dict | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class CheatingReport(BaseModel):
    interview_id: uuid.UUID
    total_events: int
    by_category: dict[str, int]
    by_severity: dict[str, int]
    integrity_score: float  # 0-100
    events: list[CheatingEventResponse]
    risk_level: str  # LOW / MEDIUM / HIGH / CRITICAL
