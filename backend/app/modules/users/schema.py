"""
User module Pydantic schemas.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    roles: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            roles=user.roles,
            created_at=user.created_at,
        )


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=100)
