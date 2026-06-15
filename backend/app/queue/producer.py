"""
Queue Producer: Adds jobs to Redis for BullMQ workers.
Uses BullMQ-compatible key format so Node.js workers can consume the jobs.
"""
import json
import logging
import time
import uuid as uuid_lib

from redis import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis_client: Redis | None = None


def get_redis_client() -> Redis:
    """Lazy-init Redis client singleton."""
    global _redis_client
    if _redis_client is None:
        use_ssl = "upstash.io" in settings.REDIS_HOST
        _redis_client = Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            ssl=use_ssl,
            decode_responses=False,
        )
        logger.info(f"Redis client connected: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
    return _redis_client


def add_job(queue_name: str, job_name: str, data: dict, opts: dict | None = None) -> str:
    """
    Add a job to a BullMQ queue in Redis-compatible format.

    BullMQ uses:
    - bull:{queue_name}:wait  (list) — job IDs waiting to be processed
    - bull:{queue_name}:{job_id} (hash) — job details

    Returns the generated job_id.
    """
    client = get_redis_client()
    job_id = str(uuid_lib.uuid4())
    timestamp = int(time.time() * 1000)

    job_opts = opts or {
        "attempts": 3,
        "backoff": {"type": "exponential", "delay": 2000},
        "removeOnComplete": 100,
        "removeOnFail": 500,
    }

    # Store job hash (BullMQ format)
    client.hset(
        f"bull:{queue_name}:{job_id}",
        mapping={
            "id": job_id,
            "name": job_name,
            "data": json.dumps(data),
            "opts": json.dumps(job_opts),
            "timestamp": str(timestamp),
            "processedOn": "",
            "finishedOn": "",
            "returnvalue": "",
            "failedReason": "",
            "attemptsMade": "0",
            "stacktrace": "[]",
        },
    )

    # Push to wait list (right push for FIFO)
    client.rpush(f"bull:{queue_name}:wait", job_id)

    # Notify waiting workers
    client.publish(f"bull:{queue_name}:events", json.dumps({
        "event": "waiting",
        "jobId": job_id,
        "queue": queue_name,
    }))

    logger.info(f"Job [{job_name}] ID={job_id} added to queue '{queue_name}'")
    return job_id


def enqueue_resume_processing(resume_id: str, file_path: str, user_id: str) -> str:
    """Enqueue a resume processing job."""
    return add_job(
        queue_name="resume-processing",
        job_name="PROCESS_RESUME",
        data={
            "resume_id": resume_id,
            "file_path": file_path,
            "user_id": user_id,
        },
    )


def enqueue_report_generation(interview_id: str) -> str:
    """Enqueue an interview report generation job."""
    return add_job(
        queue_name="generate-report",
        job_name="GENERATE_REPORT",
        data={"interview_id": interview_id},
    )


def enqueue_email(to: str, subject: str, template: str, context: dict) -> str:
    """Enqueue an email sending job."""
    return add_job(
        queue_name="send-email",
        job_name="SEND_EMAIL",
        data={
            "to": to,
            "subject": subject,
            "template": template,
            "context": context,
        },
    )
