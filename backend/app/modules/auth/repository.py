"""
Auth repository: all database operations for authentication.
"""
import logging
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


class AuthRepository:
    async def get_by_email(self, db: AsyncSession, email: str):
        from app.modules.users.model import User
        from app.modules.roles.model import UserRole

        result = await db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, user_id: uuid.UUID):
        from app.modules.users.model import User
        from app.modules.roles.model import UserRole

        result = await db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_user(self, db: AsyncSession, email: str, hashed_password: str, full_name: str):
        from app.modules.users.model import User

        user = User(email=email, hashed_password=hashed_password, full_name=full_name)
        db.add(user)
        await db.flush()  # get the generated id
        await db.refresh(user)
        logger.info(f"User created: {user.id}")
        return user

    async def assign_role(self, db: AsyncSession, user_id: uuid.UUID, role_name: str) -> None:
        from app.modules.roles.model import Role, UserRole

        result = await db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if role is None:
            # Auto-seed the role if it's missing (helps recover from failed startup seeding)
            role = Role(name=role_name)
            db.add(role)
            await db.flush()
            logger.info(f"Auto-created missing role: {role_name}")

        user_role = UserRole(user_id=user_id, role_id=role.id)
        db.add(user_role)
        await db.flush()
        logger.info(f"Role '{role_name}' assigned to user {user_id}")

    async def get_user_roles(self, db: AsyncSession, user_id: uuid.UUID) -> list[str]:
        from app.modules.roles.model import UserRole, Role

        result = await db.execute(
            select(Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
        return [row[0] for row in result.fetchall()]

    async def get_user_permissions(self, db: AsyncSession, user_id: uuid.UUID) -> list[str]:
        from app.modules.roles.model import UserRole, RolePermission, Permission

        result = await db.execute(
            select(Permission.name)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .where(UserRole.user_id == user_id)
        )
        return [row[0] for row in result.fetchall()]
