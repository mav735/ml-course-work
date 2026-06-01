"""create drawings table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "drawings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("shapes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("png", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("idx_drawings_label", "drawings", ["label"])


def downgrade() -> None:
    op.drop_index("idx_drawings_label", table_name="drawings")
    op.drop_table("drawings")
