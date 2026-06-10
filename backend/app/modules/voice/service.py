"""
Voice service: orchestrates audio processing and storage.
"""
import uuid
import logging
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.voice.processor import VoiceProcessor

logger = logging.getLogger(__name__)
settings = get_settings()
_processor = VoiceProcessor()


class VoiceService:
    async def save_audio_file(
        self,
        interview_id: uuid.UUID,
        question_id: uuid.UUID,
        audio_bytes: bytes,
    ) -> str:
        """Save raw audio bytes to storage, return file path."""
        audio_dir = Path(settings.STORAGE_PATH) / "audio" / str(interview_id)
        audio_dir.mkdir(parents=True, exist_ok=True)
        file_path = audio_dir / f"{question_id}.webm"
        with open(str(file_path), "wb") as f:
            f.write(audio_bytes)
        return str(file_path)

    async def process_audio_chunk(
        self,
        interview_id: uuid.UUID,
        question_id: uuid.UUID,
        audio_bytes: bytes,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> str:
        """Transcribe audio chunk, save answer to DB, check for external voices."""
        # Save audio file
        audio_path = await self.save_audio_file(interview_id, question_id, audio_bytes)

        # Transcribe
        transcript = await _processor.transcribe_audio_chunk(audio_bytes)

        # Check for external voices (cheating detection)
        try:
            has_external_voices = await _processor.detect_external_voices(audio_bytes)
            if has_external_voices:
                from app.modules.cheating.service import CheatingService
                from app.modules.cheating.schema import CheatingEventCreate
                from app.modules.cheating.model import CheatingCategory, SeverityLevel

                cheating_svc = CheatingService()
                await cheating_svc.report_event(
                    db=db,
                    interview_id=interview_id,
                    user_id=user_id,
                    event_data=CheatingEventCreate(
                        interview_id=interview_id,
                        category=CheatingCategory.EXTERNAL_VOICE,
                        severity=SeverityLevel.MEDIUM,
                        description="External voice detected in audio response",
                        metadata={"audio_path": audio_path},
                    ),
                )
        except Exception as exc:
            logger.warning(f"External voice check failed: {exc}")

        # Save answer to DB
        from app.modules.interviews.repository import InterviewRepository
        repo = InterviewRepository()
        await repo.save_answer(
            db,
            interview_id=interview_id,
            question_id=question_id,
            user_id=user_id,
            text=transcript,
            audio_path=audio_path,
        )

        return transcript
