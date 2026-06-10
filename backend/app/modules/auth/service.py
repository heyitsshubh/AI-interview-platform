"""
Auth service: business logic for registration, login, token refresh.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token, create_refresh_token, decode_token
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schema import SignupRequest, LoginRequest, RefreshRequest, TokenResponse
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self):
        self.repo = AuthRepository()

    async def register(self, db: AsyncSession, signup_data: SignupRequest) -> TokenResponse:
        """Register a new user and return auth tokens."""
        existing = await self.repo.get_by_email(db, signup_data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        hashed = hash_password(signup_data.password)
        user = await self.repo.create_user(
            db, signup_data.email, hashed, signup_data.full_name
        )
        await self.repo.assign_role(db, user.id, signup_data.role)
        await db.refresh(user)

        roles = await self.repo.get_user_roles(db, user.id)
        access_token = create_access_token(str(user.id), roles)
        refresh_token = create_refresh_token(str(user.id))

        logger.info(f"User registered: {user.email} with role {signup_data.role}")
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def login(self, db: AsyncSession, login_data: LoginRequest) -> TokenResponse:
        """Authenticate user and return tokens."""
        user = await self.repo.get_by_email(db, login_data.email)

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        roles = await self.repo.get_user_roles(db, user.id)
        access_token = create_access_token(str(user.id), roles)
        refresh_token = create_refresh_token(str(user.id))

        logger.info(f"User logged in: {user.email}")
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def refresh_token(self, db: AsyncSession, refresh_req: RefreshRequest) -> TokenResponse:
        """Issue a new access token using a valid refresh token."""
        import uuid
        payload = decode_token(refresh_req.refresh_token)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type. Expected refresh token.",
            )

        user_id = uuid.UUID(payload["sub"])
        user = await self.repo.get_by_id(db, user_id)

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        roles = await self.repo.get_user_roles(db, user.id)
        access_token = create_access_token(str(user.id), roles)
        new_refresh_token = create_refresh_token(str(user.id))

        return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)

    async def logout(self, user_id: str) -> dict:
        """Stateless logout: client discards tokens. Log the event."""
        logger.info(f"User logged out: {user_id}")
        return {"message": "Logged out successfully"}
