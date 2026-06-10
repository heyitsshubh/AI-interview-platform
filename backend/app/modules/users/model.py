"""
User SQLAlchemy model.
"""
import uuid
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user_roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="user", lazy="selectin")
    resumes: Mapped[list["Resume"]] = relationship("Resume", back_populates="user", lazy="dynamic")
    interviews: Mapped[list["Interview"]] = relationship("Interview", back_populates="user", lazy="dynamic")
    cheating_events: Mapped[list["CheatingEvent"]] = relationship("CheatingEvent", back_populates="user", lazy="dynamic")

    @property
    def roles(self) -> list[str]:
        return [ur.role.name for ur in self.user_roles if ur.role]

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
