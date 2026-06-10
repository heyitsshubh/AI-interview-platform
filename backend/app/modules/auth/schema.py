"""
Auth module Pydantic schemas.
"""
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    full_name: str = Field(min_length=2, max_length=100)
    role: Literal["CANDIDATE", "RECRUITER"] = "CANDIDATE"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


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
