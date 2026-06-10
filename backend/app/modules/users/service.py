"""
User service: profile management.
"""
import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.modules.users.schema import UserResponse, UpdateProfileRequest

logger = logging.getLogger(__name__)


class UserService:
    async def get_profile(self, db: AsyncSession, user_id: uuid.UUID) -> UserResponse:
        from app.modules.users.model import User
        from app.modules.roles.model import UserRole

        result = await db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserResponse.from_user(user)

    async def update_profile(self, db: AsyncSession, user_id: uuid.UUID, data: UpdateProfileRequest) -> UserResponse:
        from app.modules.users.model import User
        from app.modules.roles.model import UserRole

        result = await db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if data.full_name is not None:
            user.full_name = data.full_name

        await db.flush()
        await db.refresh(user)
        logger.info(f"Profile updated for user {user_id}")
        return UserResponse.from_user(user)

    async def list_users(self, db: AsyncSession, role_filter: str | None = None) -> list[UserResponse]:
        from app.modules.users.model import User
        from app.modules.roles.model import UserRole, Role

        query = select(User).options(selectinload(User.user_roles).selectinload(UserRole.role))
        if role_filter:
            query = query.join(UserRole, UserRole.user_id == User.id).join(Role, Role.id == UserRole.role_id).where(Role.name == role_filter)

        result = await db.execute(query)
        users = result.scalars().unique().all()
        return [UserResponse.from_user(u) for u in users]
