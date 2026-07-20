"""create dunning event log

Revision ID: 006_create_dunning_event
Revises: 005_dunning_log_history
"""

from alembic import op
import sqlalchemy as sa

revision = "006_create_dunning_event"
down_revision = "005_dunning_log_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dunning_event",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("payment_id", sa.String(length=64), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("days_overdue", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_dunning_event_payment_id", "dunning_event", ["payment_id"])


def downgrade() -> None:
    op.drop_index("ix_dunning_event_payment_id", table_name="dunning_event")
    op.drop_table("dunning_event")
