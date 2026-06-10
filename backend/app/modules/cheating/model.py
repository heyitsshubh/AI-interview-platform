"""
Cheating detection model.
Tracks all cheating events during an interview session.
"""
import uuid
from enum import Enum as PyEnum
from sqlalchemy import String, Text, ForeignKey, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CheatingCategory(str, PyEnum):
    TAB_SWITCH = "TAB_SWITCH"               # Switched browser tab
    WINDOW_BLUR = "WINDOW_BLUR"             # Window lost focus
    COPY_PASTE = "COPY_PASTE"               # Copy/paste detected
    MULTIPLE_FACES = "MULTIPLE_FACES"       # Multiple faces in camera
    NO_FACE = "NO_FACE"                     # No face detected
    LOOKING_AWAY = "LOOKING_AWAY"           # Eye gaze off screen
    EXTERNAL_VOICE = "EXTERNAL_VOICE"       # Background voices in audio
    SCREEN_SHARE = "SCREEN_SHARE"           # Screen sharing detected
    DEVTOOLS_OPEN = "DEVTOOLS_OPEN"         # DevTools opened
    KEYBOARD_MISMATCH = "KEYBOARD_MISMATCH" # Typing inconsistent with voice


class SeverityLevel(str, PyEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# Penalty weights for integrity score calculation
SEVERITY_PENALTIES = {
    SeverityLevel.LOW: 2,
    SeverityLevel.MEDIUM: 5,
    SeverityLevel.HIGH: 10,
}

# Default severity per category
CATEGORY_DEFAULT_SEVERITY = {
    CheatingCategory.TAB_SWITCH: SeverityLevel.MEDIUM,
    CheatingCategory.WINDOW_BLUR: SeverityLevel.LOW,
    CheatingCategory.COPY_PASTE: SeverityLevel.MEDIUM,
    CheatingCategory.MULTIPLE_FACES: SeverityLevel.HIGH,
    CheatingCategory.NO_FACE: SeverityLevel.MEDIUM,
    CheatingCategory.LOOKING_AWAY: SeverityLevel.LOW,
    CheatingCategory.EXTERNAL_VOICE: SeverityLevel.MEDIUM,
    CheatingCategory.SCREEN_SHARE: SeverityLevel.HIGH,
    CheatingCategory.DEVTOOLS_OPEN: SeverityLevel.HIGH,
    CheatingCategory.KEYBOARD_MISMATCH: SeverityLevel.HIGH,
}


class CheatingEvent(Base):
    __tablename__ = "cheating_events"

    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(
        Enum(CheatingCategory, name="cheating_category_enum"),
        nullable=False
    )
    severity: Mapped[str] = mapped_column(
        Enum(SeverityLevel, name="severity_level_enum"),
        nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    interview: Mapped["Interview"] = relationship("Interview", back_populates="cheating_events")
    user: Mapped["User"] = relationship("User", back_populates="cheating_events")

    def __repr__(self) -> str:
        return f"<CheatingEvent id={self.id} category={self.category} severity={self.severity}>"
