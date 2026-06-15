"""
Voice audio processing using OpenAI Whisper API.
"""
import logging
import io
from openai import AsyncOpenAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VoiceProcessor:
    def __init__(self):
        self._client = None
        if settings.OPENAI_API_KEY:
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            logger.warning("OPENAI_API_KEY not found. Voice transcription disabled.")

    async def transcribe_audio_chunk(self, audio_bytes: bytes, sample_rate: int = 16000) -> str:
        """
        Transcribe audio bytes using OpenAI Whisper.
        Returns transcribed text string.
        """
        if not self._client:
            return "[Voice transcription unavailable]"

        try:
            # Create a file-like object for OpenAI
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "audio.webm"  # OpenAI requires a filename to guess the format

            response = await self._client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
            
            # The response is directly a string when response_format="text"
            transcript = str(response).strip()
            logger.info(f"Transcribed {len(audio_bytes)} bytes: '{transcript[:50]}...'")
            return transcript

        except Exception as exc:
            logger.error(f"OpenAI Speech-to-Text error: {exc}")
            return ""

    async def transcribe_audio_file(self, file_path: str) -> str:
        """Transcribe an audio file."""
        with open(file_path, "rb") as f:
            audio_bytes = f.read()
        return await self.transcribe_audio_chunk(audio_bytes)

    async def detect_external_voices(self, audio_bytes: bytes) -> bool:
        """
        OpenAI Whisper does not natively support speaker diarization.
        Returning False to bypass cheating detection for multiple speakers.
        (Other cheating detection like tab switching still works).
        """
        return False
