"""create dunning log

Revision ID: 004_create_dunning_log
Revises: 003_create_instagram_messages
"""

from alembic import op
import sqlalchemy as sa

revision = "004_create_dunning_log"
down_revision = "003_create_instagram_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dunning_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("payment_id", sa.String(length=64), nullable=False),
        sa.Column("send_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_dunning_log_payment_id_unique", "dunning_log", ["payment_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_dunning_log_payment_id_unique", table_name="dunning_log")
    op.drop_table("dunning_log")
