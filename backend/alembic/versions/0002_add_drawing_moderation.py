"""add drawing moderation
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "drawings",
        sa.Column(
            "moderation_status",
            sa.String(length=20),
            server_default="approved",
            nullable=False,
        ),
    )
    op.add_column("drawings", sa.Column("reviewed_by", sa.String(length=50), nullable=True))
    op.add_column(
        "drawings",
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_drawings_moderation_status",
        "drawings",
        "moderation_status in ('pending', 'approved', 'rejected')",
    )
    op.create_index(
        "idx_drawings_moderation_status_created_at",
        "drawings",
        ["moderation_status", "created_at"],
    )
    op.alter_column("drawings", "moderation_status", server_default="pending")


def downgrade() -> None:
    op.drop_index("idx_drawings_moderation_status_created_at", table_name="drawings")
    op.drop_constraint("ck_drawings_moderation_status", "drawings", type_="check")
    op.drop_column("drawings", "reviewed_at")
    op.drop_column("drawings", "reviewed_by")
    op.drop_column("drawings", "moderation_status")
