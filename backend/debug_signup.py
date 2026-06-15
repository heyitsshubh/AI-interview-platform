import asyncio
import sys
import os
from sqlalchemy import select

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import get_settings
from app.core.database import engine, create_tables
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schema import SignupRequest
from app.modules.roles.model import Role

async def debug_signup():
    print("Testing DB connection...")
    try:
        await create_tables()
        print("Tables created or already exist.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        return

    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        repo = AuthRepository()
        
        # Test 1: Check roles
        print("Checking roles...")
        result = await db.execute(select(Role))
        roles = result.scalars().all()
        print(f"Roles found: {[r.name for r in roles]}")

        # Test 2: Try signup logic
        print("Attempting manual signup logic...")
        try:
            signup_data = SignupRequest(
                email="test_debug@example.com",
                password="Password123!",
                full_name="Debug User",
                role="CANDIDATE"
            )
            # This is what auth/service.py does:
            existing = await repo.get_by_email(db, signup_data.email)
            if existing:
                print("Test email already exists.")
            else:
                from app.core.security import hash_password
                hashed = hash_password(signup_data.password)
                user = await repo.create_user(db, signup_data.email, hashed, signup_data.full_name)
                print(f"User created: {user.id}")
                await repo.assign_role(db, user.id, signup_data.role)
                print("Role assigned successfully.")
        except Exception as e:
            import traceback
            print("ERROR DURING SIGNUP LOGIC:")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_signup())
