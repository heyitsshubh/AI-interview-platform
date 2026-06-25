import asyncio
import uuid
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.config import get_settings
from app.modules.auth.repository import AuthRepository
from app.core.security import hash_password

# Force SQLAlchemy to register all models
import app.modules.users.model
import app.modules.roles.model
import app.modules.resumes.model
import app.modules.interviews.model
import app.modules.cheating.model

async def test_signup():
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    repo = AuthRepository()
    
    async with async_session() as db:
        try:
            print("Creating user...")
            hashed = hash_password("testpassword123")
            user = await repo.create_user(db, f"test_{uuid.uuid4()}@example.com", hashed, "Test User")
            print(f"User created: {user.id}")
            
            print("Assigning role...")
            await repo.assign_role(db, user.id, "CANDIDATE")
            print("Role assigned.")
            
            await db.commit()
            print("Commit successful!")
        except Exception as e:
            import traceback
            print(f"FAILED: {type(e).__name__} - {e}")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_signup())
