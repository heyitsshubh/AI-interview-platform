"""
Voice audio processing using Google Cloud Speech-to-Text.
"""
import logging
import io
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VoiceProcessor:
    def __init__(self):
        self._client = None

    def _get_client(self):
        """Lazy init Google Speech client."""
        if self._client is None:
            try:
                from google.cloud import speech
                import os
                if settings.GOOGLE_APPLICATION_CREDENTIALS:
                    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
                self._client = speech.SpeechClient()
            except ImportError:
                logger.warning("google-cloud-speech not installed. Voice transcription disabled.")
                self._client = None
        return self._client

    async def transcribe_audio_chunk(self, audio_bytes: bytes, sample_rate: int = 16000) -> str:
        """
        Transcribe audio bytes using Google Cloud Speech-to-Text.
        Returns transcribed text string.
        """
        client = self._get_client()
        if client is None:
            return "[Voice transcription unavailable]"

        try:
            from google.cloud import speech

            audio = speech.RecognitionAudio(content=audio_bytes)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                sample_rate_hertz=sample_rate,
                language_code="en-US",
                enable_automatic_punctuation=True,
                model="latest_long",
                use_enhanced=True,
            )

            response = client.recognize(config=config, audio=audio)
            if not response.results:
                return ""

            transcript = " ".join(
                result.alternatives[0].transcript
                for result in response.results
                if result.alternatives
            )
            logger.info(f"Transcribed {len(audio_bytes)} bytes: '{transcript[:50]}...'")
            return transcript

        except Exception as exc:
            logger.error(f"Speech-to-Text error: {exc}")
            return ""

    async def transcribe_audio_file(self, file_path: str) -> str:
        """Transcribe an audio file."""
        with open(file_path, "rb") as f:
            audio_bytes = f.read()
        return await self.transcribe_audio_chunk(audio_bytes)

    async def detect_external_voices(self, audio_bytes: bytes) -> bool:
        """
        Detect if multiple speakers are present in the audio.
        Returns True if external voices detected (potential cheating).
        """
        client = self._get_client()
        if client is None:
            return False

        try:
            from google.cloud import speech

            audio = speech.RecognitionAudio(content=audio_bytes)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                sample_rate_hertz=16000,
                language_code="en-US",
                enable_speaker_diarization=True,
                diarization_speaker_count=2,
                model="latest_long",
            )

            response = client.recognize(config=config, audio=audio)
            if not response.results:
                return False

            last_result = response.results[-1]
            if not last_result.alternatives:
                return False

            words = last_result.alternatives[0].words
            speaker_tags = {word.speaker_tag for word in words}
            # More than 1 speaker tag = external voice detected
            return len(speaker_tags) > 1

        except Exception as exc:
            logger.error(f"Speaker detection error: {exc}")
            return False
