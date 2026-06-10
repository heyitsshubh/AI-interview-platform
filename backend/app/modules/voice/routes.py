"""
Voice WebSocket endpoint for real-time audio streaming.
"""
import uuid
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.jwt import decode_token
from app.modules.voice.service import VoiceService

router = APIRouter(prefix="/api/voice", tags=["Voice Processing"])
logger = logging.getLogger(__name__)
_voice_service = VoiceService()


@router.websocket("/ws/{interview_id}/stream")
async def voice_stream(
    websocket: WebSocket,
    interview_id: uuid.UUID,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time voice streaming.

    Protocol:
    - Connect with ?token=<access_token>
    - Client sends binary audio frames (WebM/Opus format, 16kHz)
    - Client sends JSON {type: 'end_chunk', question_id: str} to trigger transcription
    - Server responds with JSON {type: 'transcript', text: str, question_id: str}
    - Server auto-detects external voices and reports cheating events
    """
    await websocket.accept()

    # Authenticate
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.send_json({"type": "error", "message": "Invalid token type"})
            await websocket.close(code=4001)
            return
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        await websocket.send_json({"type": "error", "message": "Authentication failed"})
        await websocket.close(code=4001)
        return

    from app.core.database import AsyncSessionLocal

    audio_buffer = bytearray()
    current_question_id: uuid.UUID | None = None

    logger.info(f"Voice stream connected: interview={interview_id} user={user_id}")
    await websocket.send_json({"type": "connected", "message": "Voice stream ready"})

    try:
        async with AsyncSessionLocal() as db:
            while True:
                data = await websocket.receive()

                if data["type"] == "websocket.disconnect":
                    break

                if data["type"] == "websocket.receive":
                    if data.get("bytes"):
                        # Accumulate audio buffer
                        audio_buffer.extend(data["bytes"])

                    elif data.get("text"):
                        message = json.loads(data["text"])
                        msg_type = message.get("type")

                        if msg_type == "start_chunk":
                            # Client signals start of a new audio chunk
                            audio_buffer.clear()
                            q_id_str = message.get("question_id")
                            if q_id_str:
                                current_question_id = uuid.UUID(q_id_str)
                            else:
                                current_question_id = uuid.uuid4()
                            await websocket.send_json({
                                "type": "recording",
                                "question_id": str(current_question_id),
                            })

                        elif msg_type == "end_chunk":
                            # Transcribe accumulated buffer
                            q_id_str = message.get("question_id")
                            if not q_id_str:
                                await websocket.send_json({"type": "error", "message": "question_id required"})
                                continue

                            current_question_id = uuid.UUID(q_id_str)

                            if len(audio_buffer) == 0:
                                await websocket.send_json({
                                    "type": "transcript",
                                    "text": "",
                                    "question_id": q_id_str,
                                })
                                continue

                            transcript = await _voice_service.process_audio_chunk(
                                interview_id=interview_id,
                                question_id=current_question_id,
                                audio_bytes=bytes(audio_buffer),
                                db=db,
                                user_id=user_id,
                            )

                            await websocket.send_json({
                                "type": "transcript",
                                "text": transcript,
                                "question_id": q_id_str,
                            })
                            audio_buffer.clear()

                        elif msg_type == "ping":
                            await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"Voice stream disconnected: interview={interview_id}")
    except Exception as exc:
        logger.error(f"Voice stream error: {exc}")
    finally:
        logger.info(f"Voice stream closed: interview={interview_id} user={user_id}")
