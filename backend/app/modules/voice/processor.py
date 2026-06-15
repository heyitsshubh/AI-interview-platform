"""
Voice audio processing using Google Gemini API.
"""
import logging
import tempfile
import os
import asyncio
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

class VoiceProcessor:
    def __init__(self):
        self._configured = False
        if settings.GEMINI_API_KEY:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINII_API_KEY)
            self._model = genai.GenerativeModel("gemini-1.5-flash")
            self._configured = True
        else:
            logger.warning("GEMINI_API_KEY not found. Voice transcription disabled.")

    async def transcribe_audio_chunk(self, audio_bytes: bytes, sample_rate: int = 16000) -> str:
        """
        Transcribe audio bytes using Google Gemini.
        Returns transcribed text string.
        """
        if not self._configured:
            return "[Voice transcription unavailable]"

        import google.generativeai as genai
        
        # Gemini requires a file upload for audio processing
        temp_file_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name

            # Upload to Gemini File API
            uploaded_file = await asyncio.to_thread(genai.upload_file, path=temp_file_path)
            
            # Generate content (Transcription)
            prompt = "Accurately transcribe the spoken audio in this file. Reply with ONLY the transcript, nothing else. If it is silent or you cannot hear anything, reply with '[silence]'."
            
            # Gemini models are sync by default in this SDK pattern, wrap in to_thread
            response = await asyncio.to_thread(self._model.generate_content, [prompt, uploaded_file])
            
            transcript = response.text.strip()
            
            # Cleanup uploaded file from Google servers
            await asyncio.to_thread(genai.delete_file, uploaded_file.name)
            
            logger.info(f"Transcribed {len(audio_bytes)} bytes: '{transcript[:50]}...'")
            return transcript

        except Exception as exc:
            logger.error(f"Gemini Speech-to-Text error: {exc}")
            return ""
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    async def transcribe_audio_file(self, file_path: str) -> str:
        """Transcribe an audio file."""
        with open(file_path, "rb") as f:
            audio_bytes = f.read()
        return await self.transcribe_audio_chunk(audio_bytes)

    async def detect_external_voices(self, audio_bytes: bytes) -> bool:
        """
        Gemini audio transcription doesn't natively expose diarization tags via simple prompt.
        Returning False to bypass cheating detection for multiple speakers.
        """
        return False
