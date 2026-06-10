"""
Auth API routes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user
from app.modules.auth.controller import AuthController
from app.modules.auth.schema import SignupRequest, LoginRequest, RefreshRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
_controller = AuthController()


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new CANDIDATE or RECRUITER account."""
    return await _controller.signup(db, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate and receive access + refresh tokens."""
    return await _controller.login(db, data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for a new access token."""
    return await _controller.refresh(db, data)


@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    """Logout (stateless: client discards token)."""
    return await _controller.logout(current_user)


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return await _controller.me(current_user)
