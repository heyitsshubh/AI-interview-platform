"""
Queue Producer: Adds jobs to Redis for BullMQ workers.
Uses the official Python bullmq package to guarantee compatibility with Node.js workers.
"""
import logging
from bullmq import Queue
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def get_redis_opts() -> dict:
    use_ssl = "upstash.io" in settings.REDIS_HOST
    return {
        "host": settings.REDIS_HOST,
        "port": settings.REDIS_PORT,
        "password": settings.REDIS_PASSWORD,
        "ssl": use_ssl,
    }

async def add_job(queue_name: str, job_name: str, data: dict) -> str:
    """
    Add a job to a BullMQ queue using the official Python client.
    """
    try:
        queue = Queue(queue_name, {"connection": get_redis_opts()})
        
        job = await queue.add(
            job_name,
            data,
            opts={
                "attempts": 3,
                "backoff": {"type": "exponential", "delay": 2000},
                "removeOnComplete": 100,
                "removeOnFail": 500,
            }
        )
        await queue.close()
        logger.info(f"Job [{job_name}] ID={job.id} added to queue '{queue_name}'")
        return str(job.id)
    except Exception as exc:
        logger.error(f"Failed to enqueue job {job_name} to {queue_name}: {exc}")
        return ""

async def enqueue_resume_processing(resume_id: str, file_path: str, user_id: str) -> str:
    """Enqueue a resume processing job."""
    return await add_job(
        queue_name="resume-processing",
        job_name="PROCESS_RESUME",
        data={
            "resume_id": resume_id,
            "file_path": file_path,
            "user_id": user_id,
        },
    )

async def enqueue_report_generation(interview_id: str) -> str:
    """Enqueue an interview report generation job."""
    return await add_job(
        queue_name="generate-report",
        job_name="GENERATE_REPORT",
        data={"interview_id": interview_id},
    )

async def enqueue_email(to: str, subject: str, template: str, context: dict) -> str:
    """Enqueue an email sending job."""
    return await add_job(
        queue_name="send-email",
        job_name="SEND_EMAIL",
        data={
            "to": to,
            "subject": subject,
            "template": template,
            "context": context,
        },
    )
