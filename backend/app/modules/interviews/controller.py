"""
Interview controller: routes delegate here.
"""
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.interviews.service import InterviewService

logger = logging.getLogger(__name__)


class InterviewController:
    def __init__(self):
        self.service = InterviewService()

    async def create(self, db, current_user, data):
        return await self.service.create_interview(
            db, current_user,
            job_title=data.job_title,
            job_description=data.job_description,
            resume_id=data.resume_id,
            total_questions=data.total_questions,
        )

    async def get(self, db, interview_id, current_user):
        return await self.service.get_interview(db, interview_id, current_user)

    async def history(self, db, current_user):
        return await self.service.get_history(db, current_user)

    async def start(self, db, interview_id, current_user):
        return await self.service.start_interview(db, interview_id, current_user)

    async def complete(self, db, interview_id, current_user):
        return await self.service.complete_interview(db, interview_id, current_user)

    async def questions(self, db, interview_id):
        return await self.service.get_interview_questions(db, interview_id)
