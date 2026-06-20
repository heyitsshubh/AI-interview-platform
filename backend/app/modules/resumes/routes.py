"""
Resume upload and retrieval API routes.
"""
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user, require_role
from app.modules.resumes.service import ResumeService

router = APIRouter(prefix="/api/resumes", tags=["Resumes"])
_service = ResumeService()


class ResumeResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    original_filename: str
    file_path: str
    status: str
    extracted_text: str | None = None
    embedding_path: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


@router.post("/upload", response_model=ResumeResponse, status_code=201)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user=Depends(require_role("CANDIDATE")),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF resume. Only CANDIDATE role allowed.
    Processing starts immediately in the background — no external worker needed."""
    resume = await _service.upload_resume(db, current_user.id, file, background_tasks)
    return ResumeResponse.model_validate(resume)


@router.get("/me", response_model=list[ResumeResponse])
async def list_my_resumes(
    current_user=Depends(require_role("CANDIDATE")),
    db: AsyncSession = Depends(get_db),
):
    """List all resumes uploaded by the current candidate."""
    resumes = await _service.list_user_resumes(db, current_user.id)
    return [ResumeResponse.model_validate(r) for r in resumes]


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get resume by ID. Owner or RECRUITER can access."""
    resume = await _service.get_resume(db, resume_id, current_user)
    return ResumeResponse.model_validate(resume)


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete resume by ID."""
    await _service.delete_resume(db, resume_id, current_user)
    return None
