import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.config import get_settings
from app.modules.interviews.model import Answer
from app.modules.interviews.repository import InterviewRepository

async def test_db():
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    repo = InterviewRepository()
    
    async with async_session() as db:
        print("Checking for interviews...")
        # Get latest interview
        result = await db.execute(text("SELECT id, user_id FROM interviews ORDER BY created_at DESC LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("No interviews found in DB!")
            return
            
        interview_id = row[0]
        user_id = row[1]
        print(f"Found Interview ID: {interview_id}, User ID: {user_id}")
        
        print("Checking for questions...")
        # Get first question
        q_result = await db.execute(text(f"SELECT id FROM questions WHERE interview_id = '{interview_id}' ORDER BY order_index LIMIT 1"))
        q_row = q_result.fetchone()
        if not q_row:
            print("No questions found in DB!")
            return
            
        question_id = q_row[0]
        print(f"Found Question ID: {question_id}")
        
        print("Attempting to save answer...")
        try:
            answer = await repo.save_answer(
                db=db,
                interview_id=interview_id,
                question_id=question_id,
                user_id=user_id,
                text="Test Answer via script",
                audio_path=None
            )
            print(f"SUCCESS! Saved Answer ID: {answer.id}")
            
            # Verify it's in DB
            a_result = await db.execute(text("SELECT count(*) FROM answers"))
            count = a_result.scalar()
            print(f"Total rows in answers table: {count}")
            
        except Exception as e:
            import traceback
            print(f"FAILED to save answer: {type(e).__name__} - {e}")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_db())
