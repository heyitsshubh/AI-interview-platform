"""
Role and Permission SQLAlchemy models.
Implements RBAC with two roles: CANDIDATE and RECRUITER.
"""
import uuid
from enum import Enum as PyEnum
from sqlalchemy import String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class RoleName(str, PyEnum):
    CANDIDATE = "CANDIDATE"
    RECRUITER = "RECRUITER"


class Role(Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(
        Enum(RoleName, name="role_name_enum"),
        unique=True,
        nullable=False
    )

    user_roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="role")
    role_permissions: Mapped[list["RolePermission"]] = relationship("RolePermission", back_populates="role", lazy="selectin")

    @property
    def permissions(self) -> list[str]:
        return [rp.permission.name for rp in self.role_permissions if rp.permission]

    def __repr__(self) -> str:
        return f"<Role name={self.name}>"


class Permission(Base):
    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=True)

    role_permissions: Mapped[list["RolePermission"]] = relationship("RolePermission", back_populates="permission")

    def __repr__(self) -> str:
        return f"<Permission name={self.name}>"


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="user_roles")
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles", lazy="selectin")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False
    )

    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="role_permissions", lazy="selectin")
