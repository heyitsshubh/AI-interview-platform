"""
Interview API routes including WebSocket session handler.
"""
import uuid
import logging
import json
from datetime import datetime
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user, require_role
from app.core.jwt import decode_token
from app.modules.interviews.controller import InterviewController

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])
_controller = InterviewController()

logger = logging.getLogger(__name__)


class CreateInterviewRequest(BaseModel):
    job_title: str
    job_description: str | None = None
    resume_id: uuid.UUID | None = None
    total_questions: int = 10


class QuestionResponse(BaseModel):
    id: uuid.UUID
    text: str
    order_index: int
    question_type: str
    model_config = {"from_attributes": True}


class InterviewResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    job_title: str
    status: str
    total_questions: int
    created_at: datetime
    model_config = {"from_attributes": True}


@router.post("/", response_model=InterviewResponse, status_code=201)
async def create_interview(
    data: CreateInterviewRequest,
    current_user=Depends(require_role("CANDIDATE")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new interview session. CANDIDATE only."""
    interview = await _controller.create(db, current_user, data)
    return InterviewResponse.model_validate(interview)


@router.get("/history", response_model=list[InterviewResponse])
async def interview_history(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get interview history. CANDIDATE sees own; RECRUITER sees all."""
    interviews = await _controller.history(db, current_user)
    return [InterviewResponse.model_validate(i) for i in interviews]


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    interview = await _controller.get(db, interview_id, current_user)
    return InterviewResponse.model_validate(interview)


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    interview_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an interview."""
    await _controller.delete(db, interview_id, current_user)
    return None


@router.post("/{interview_id}/start")
async def start_interview(
    interview_id: uuid.UUID,
    current_user=Depends(require_role("CANDIDATE")),
    db: AsyncSession = Depends(get_db),
):
    """Start the interview: generates AI questions and sets status ACTIVE."""
    return await _controller.start(db, interview_id, current_user)


@router.post("/{interview_id}/complete")
async def complete_interview(
    interview_id: uuid.UUID,
    current_user=Depends(require_role("CANDIDATE")),
    db: AsyncSession = Depends(get_db),
):
    """Mark interview complete and trigger report generation."""
    return await _controller.complete(db, interview_id, current_user)


@router.get("/{interview_id}/questions", response_model=list[QuestionResponse])
async def get_questions(
    interview_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all questions for an interview."""
    questions = await _controller.questions(db, interview_id)
    return [QuestionResponse.model_validate(q) for q in questions]


@router.websocket("/ws/{interview_id}/session")
async def interview_websocket_session(
    websocket: WebSocket,
    interview_id: uuid.UUID,
    token: str = Query(..., description="JWT access token"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """
    Real-time interview WebSocket session.
    - Authenticate via ?token=<access_token>
    - Receive JSON: {type: 'answer', question_id: str, text: str}
    - Receive binary: audio bytes for voice input
    - Send JSON: {type: 'question', ...} or {type: 'status', ...}
    """
    await websocket.accept()

    # Log connection unconditionally
    with open('/app/error.log', 'a') as f:
        f.write(f"WEBSOCKET CONNECTION OPENED FOR INTERVIEW {interview_id}\n")

    # Authenticate
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.send_json({"type": "error", "message": "Invalid token type"})
            await websocket.close(code=4001)
            return

        user_id_str = payload.get("sub")
        user_id = uuid.UUID(user_id_str)
    except Exception:
        await websocket.send_json({"type": "error", "message": "Authentication failed"})
        await websocket.close(code=4001)
        return

    # Load interview and questions
    from app.modules.interviews.model import Interview, Answer
    from app.modules.auth.repository import AuthRepository
    from sqlalchemy import select

    auth_repo = AuthRepository()
    current_user = await auth_repo.get_by_id(db, user_id)
    if not current_user:
        await websocket.send_json({"type": "error", "message": "User not found"})
        await websocket.close(code=4003)
        return

    service = _controller.service
    interview = await service.get_interview(db, interview_id, current_user)
    questions = await service.get_interview_questions(db, interview_id)

    if not questions:
        await websocket.send_json({"type": "error", "message": "No questions found. Start the interview first."})
        await websocket.close(code=4004)
        return

    repo = _controller.service.repo
    answered_count = 0
    current_q_index = 0

    # Send first question
    first_q = questions[0]
    await websocket.send_json({
        "type": "question",
        "question_id": str(first_q.id),
        "text": first_q.text,
        "order": first_q.order_index,
        "question_type": first_q.question_type,
        "total_questions": len(questions),
    })

    try:
        while True:
            data = await websocket.receive()

            if data["type"] == "websocket.disconnect":
                break

            if data["type"] == "websocket.receive":
                if data.get("text"):
                    # JSON message
                    message = json.loads(data["text"])
                    msg_type = message.get("type")

                    if msg_type == "answer":
                        question_id = uuid.UUID(message.get("question_id"))
                        answer_text = message.get("text", "")

                        # Save answer
                        with open('/app/error.log', 'a') as f:
                            f.write(f"RECEIVED ANSWER PAYLOAD FOR QUESTION {question_id}\n")
                            
                        try:
                            await repo.save_answer(
                                db,
                                interview_id=interview_id,
                                question_id=question_id,
                                user_id=user_id,
                                text=answer_text,
                            )
                        except Exception as e:
                            import traceback
                            with open('/app/error.log', 'a') as f:
                                f.write(f"Error saving answer: {e}\n")
                                f.write(traceback.format_exc() + "\n")
                            # Continue anyway to see if the rest of the flow works
                            
                        answered_count += 1
                        current_q_index += 1

                        # Send next question or end
                        if current_q_index < len(questions):
                            next_q = questions[current_q_index]
                            await websocket.send_json({
                                "type": "question",
                                "question_id": str(next_q.id),
                                "text": next_q.text,
                                "order": next_q.order_index,
                                "question_type": next_q.question_type,
                                "total_questions": len(questions),
                                "answered": answered_count,
                            })
                        else:
                            # Mark interview as COMPLETED
                            from app.modules.interviews.model import Interview
                            from sqlalchemy import select as sa_select
                            iw_result = await db.execute(sa_select(Interview).where(Interview.id == interview_id))
                            iw = iw_result.scalar_one_or_none()
                            if iw:
                                iw.status = "COMPLETED"
                                await db.flush()
                                await db.commit()

                            # Trigger AI evaluation in background (no BullMQ needed)
                            from app.background.evaluator import run_evaluation_background
                            background_tasks.add_task(run_evaluation_background, interview_id)
                            logger.info(f"Evaluation background task queued for interview {interview_id}")

                            await websocket.send_json({
                                "type": "completed",
                                "message": "Interview complete! Your report is being generated.",
                                "answered_questions": answered_count,
                            })
                            break

                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})

                elif data.get("bytes"):
                    # Binary audio data - forward to voice service
                    audio_bytes = data["bytes"]
                    # Get current question
                    if current_q_index < len(questions):
                        current_q = questions[current_q_index]
                        try:
                            from app.modules.voice.service import VoiceService
                            voice_svc = VoiceService()
                            transcript = await voice_svc.process_audio_chunk(
                                interview_id=interview_id,
                                question_id=current_q.id,
                                audio_bytes=audio_bytes,
                                db=db,
                                user_id=user_id,
                            )
                            await websocket.send_json({
                                "type": "transcript",
                                "text": transcript,
                                "question_id": str(current_q.id),
                            })
                        except Exception as exc:
                            logger.error(f"Voice processing error: {exc}")
                            await websocket.send_json({"type": "error", "message": "Voice processing failed"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for interview {interview_id}")
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}")
    finally:
        logger.info(f"WS session ended. Interview: {interview_id}, Answered: {answered_count}")
