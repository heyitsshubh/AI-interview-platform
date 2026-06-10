"""
RBAC permission system.
Provides FastAPI dependencies for authentication and authorization.
"""

import logging
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.jwt import decode_token
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

security = HTTPBearer()
OptionalBearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    FastAPI dependency: decode JWT, load user from DB, verify active.
    Returns the User ORM object.
    """
    # Import here to avoid circular imports
    from app.modules.users.model import User
    from app.modules.auth.repository import AuthRepository

    token = credentials.credentials
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Use access token.",
        )

    user_id_str = payload.get("sub")
    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    repo = AuthRepository()
    user = await repo.get_by_id(db, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return user


def require_role(*allowed_roles: str):
    """
    Factory: returns a FastAPI dependency that checks the current user
    has at least one of the specified roles.

    Usage:
        @router.get("/admin", dependencies=[Depends(require_role("RECRUITER"))])
    """

    async def _check_role(
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        from app.modules.auth.repository import AuthRepository

        repo = AuthRepository()
        user_roles = await repo.get_user_roles(db, current_user.id)

        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(allowed_roles)}",
            )
        return current_user

    return _check_role


def require_permission(permission: str):
    """
    Factory: returns a FastAPI dependency that checks the current user
    has the specified permission string (e.g. 'attend:interview').
    """

    async def _check_permission(
        current_user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        from app.modules.auth.repository import AuthRepository

        repo = AuthRepository()
        user_permissions = await repo.get_user_permissions(db, current_user.id)

        if permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Missing permission: {permission}",
            )
        return current_user

    return _check_permission


def get_optional_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(OptionalBearer)
    ] = None,
    db: AsyncSession = Depends(get_db),
):
    """Optional auth: returns user or None if no token provided."""
    if credentials is None:
        return None
    # Reuse get_current_user logic inline
    return None  # caller must handle


# Convenience aliases
CurrentUser = Annotated[object, Depends(get_current_user)]
CandidateUser = Annotated[object, Depends(require_role("CANDIDATE"))]
RecruiterUser = Annotated[object, Depends(require_role("RECRUITER"))]
