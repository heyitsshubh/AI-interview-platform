"""
Auth controller: thin layer between routes and service.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.service import AuthService
from app.modules.auth.schema import SignupRequest, LoginRequest, RefreshRequest, TokenResponse, UserResponse

logger = logging.getLogger(__name__)


class AuthController:
    def __init__(self):
        self.service = AuthService()

    async def signup(self, db: AsyncSession, signup_data: SignupRequest) -> TokenResponse:
        return await self.service.register(db, signup_data)

    async def login(self, db: AsyncSession, login_data: LoginRequest) -> TokenResponse:
        return await self.service.login(db, login_data)

    async def refresh(self, db: AsyncSession, refresh_data: RefreshRequest) -> TokenResponse:
        return await self.service.refresh_token(db, refresh_data)

    async def logout(self, current_user) -> dict:
        return await self.service.logout(str(current_user.id))

    async def me(self, current_user) -> UserResponse:
        return UserResponse.from_user(current_user)
