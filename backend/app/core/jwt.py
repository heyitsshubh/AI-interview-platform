"""
JWT token creation and verification.
Handles access tokens (short-lived) and refresh tokens (long-lived).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    """Internal helper: create a signed JWT with expiry."""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    payload.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, roles: list[str]) -> str:
    """Create a short-lived access token."""
    return _create_token(
        data={"sub": user_id, "roles": roles, "type": "access"},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    """Create a long-lived refresh token."""
    return _create_token(
        data={"sub": user_id, "type": "refresh"},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.
    Raises HTTP 401 if token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            logger.warning("JWT missing 'sub' claim")
            raise credentials_exception
        return payload
    except JWTError as exc:
        logger.warning(f"JWT decode error: {exc}")
        raise credentials_exception from exc


def extract_user_id(token: str) -> str:
    """Extract user_id (sub) from token."""
    payload = decode_token(token)
    return payload["sub"]


def extract_roles(token: str) -> list[str]:
    """Extract roles list from access token."""
    payload = decode_token(token)
    return payload.get("roles", [])
