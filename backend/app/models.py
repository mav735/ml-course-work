from datetime import datetime

from sqlalchemy import CheckConstraint, Index, Integer, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Drawing(Base):
    __tablename__ = "drawings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    shapes: Mapped[list] = mapped_column(JSONB, nullable=False)
    png: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    moderation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "moderation_status in ('pending', 'approved', 'rejected')",
            name="ck_drawings_moderation_status",
        ),
        Index("idx_drawings_label", "label"),
        Index("idx_drawings_moderation_status_created_at", "moderation_status", "created_at"),
    )
