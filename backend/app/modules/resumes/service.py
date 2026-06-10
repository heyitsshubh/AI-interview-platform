"""
Resume service: file upload, storage, and job enqueueing.
"""
import uuid
import logging
import os
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile, HTTPException, status
import aiofiles

from app.core.config import get_settings
from app.queue.producer import enqueue_resume_processing

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_MIME_TYPES = {"application/pdf", "application/x-pdf"}
MAX_FILE_SIZE_MB = 10


class ResumeService:
    async def upload_resume(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        file: UploadFile,
    ):
        from app.modules.resumes.model import Resume

        # Validate MIME type
        if file.content_type not in ALLOWED_MIME_TYPES and not (file.filename or "").endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only PDF files are allowed",
            )

        # Read file content
        content = await file.read()
        size_mb = len(content) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB",
            )

        # Build storage path
        user_dir = Path(settings.STORAGE_PATH) / "resumes" / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        file_id = uuid.uuid4()
        safe_filename = f"{file_id}_{file.filename}"
        file_path = user_dir / safe_filename

        # Save file asynchronously
        async with aiofiles.open(str(file_path), "wb") as f:
            await f.write(content)

        # Create DB record
        resume = Resume(
            user_id=user_id,
            file_path=str(file_path),
            original_filename=file.filename or "resume.pdf",
        )
        db.add(resume)
        await db.flush()
        await db.refresh(resume)

        # Enqueue BullMQ job
        job_id = enqueue_resume_processing(
            resume_id=str(resume.id),
            file_path=str(file_path),
            user_id=str(user_id),
        )
        logger.info(f"Resume {resume.id} uploaded, job {job_id} queued")
        return resume

    async def get_resume(self, db: AsyncSession, resume_id: uuid.UUID, current_user):
        from app.modules.resumes.model import Resume

        result = await db.execute(select(Resume).where(Resume.id == resume_id))
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

        # Owner or recruiter can access
        user_roles = current_user.roles
        if resume.user_id != current_user.id and "RECRUITER" not in user_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        return resume

    async def list_user_resumes(self, db: AsyncSession, user_id: uuid.UUID) -> list:
        from app.modules.resumes.model import Resume

        result = await db.execute(
            select(Resume).where(Resume.user_id == user_id).order_by(Resume.created_at.desc())
        )
        return result.scalars().all()

    async def update_resume_status(
        self,
        db: AsyncSession,
        resume_id: uuid.UUID,
        status_val: str,
        extracted_text: str | None = None,
        embedding_path: str | None = None,
    ):
        from app.modules.resumes.model import Resume

        result = await db.execute(select(Resume).where(Resume.id == resume_id))
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

        resume.status = status_val
        if extracted_text is not None:
            resume.extracted_text = extracted_text
        if embedding_path is not None:
            resume.embedding_path = embedding_path

        await db.flush()
        return resume
