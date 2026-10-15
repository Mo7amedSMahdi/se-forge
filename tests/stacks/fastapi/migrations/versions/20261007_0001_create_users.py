"""create users

Revision ID: 0001
Revises:
Create Date: 2026-10-07
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('ACTIVE', 'SUSPENDED')", name="ck_users_status"),
    )
    op.create_index("ux_users_email", "users", ["email"], unique=True)
    # The list order (newest first, then id) is served by one index.
    op.execute("CREATE INDEX ix_users_created_at_id ON users (created_at DESC, id DESC)")


def downgrade() -> None:
    op.drop_index("ix_users_created_at_id", table_name="users")
    op.drop_index("ux_users_email", table_name="users")
    op.drop_table("users")
