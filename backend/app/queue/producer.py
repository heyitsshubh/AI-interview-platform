"""
Queue Producer — DEPRECATED.
BullMQ has been removed. All background processing now uses FastAPI BackgroundTasks.
This file is kept as a stub to avoid import errors from any remaining references.
"""
import logging

logger = logging.getLogger(__name__)


def get_redis_client():
    """Returns None — Redis is no longer used."""
    return None


async def add_job(queue_name: str, job_name: str, data: dict) -> str:
    logger.warning(f"add_job called but BullMQ is removed. Queue: {queue_name}, Job: {job_name}")
    return ""


async def enqueue_resume_processing(resume_id: str, file_path: str, user_id: str) -> str:
    logger.warning("enqueue_resume_processing called but BullMQ is removed — using BackgroundTasks instead")
    return ""


async def enqueue_report_generation(interview_id: str) -> str:
    logger.warning("enqueue_report_generation called but BullMQ is removed — using BackgroundTasks instead")
    return ""


async def enqueue_email(to: str, subject: str, template: str, context: dict) -> str:
    logger.warning("enqueue_email called but BullMQ is removed")
    return ""
