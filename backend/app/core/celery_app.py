"""
Celery configuration for background tasks.
"""

from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ai_interview",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url,  # Use Redis for results as well
    include=["app.tasks.celery_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True
)
