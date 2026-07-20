"""add history fields to dunning log

Revision ID: 005_dunning_log_history
Revises: 004_create_dunning_log
"""

from alembic import op
import sqlalchemy as sa

revision = "005_dunning_log_history"
down_revision = "004_create_dunning_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dunning_log", sa.Column("customer", sa.String(length=200), nullable=False, server_default=""))
    op.add_column("dunning_log", sa.Column("value", sa.Float(), nullable=False, server_default="0"))
    op.add_column("dunning_log", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("dunning_log", sa.Column("resolved_status", sa.String(length=40), nullable=False, server_default=""))
    op.add_column("dunning_log", sa.Column("resolved_payment_date", sa.String(length=20), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("dunning_log", "resolved_payment_date")
    op.drop_column("dunning_log", "resolved_status")
    op.drop_column("dunning_log", "resolved_at")
    op.drop_column("dunning_log", "value")
    op.drop_column("dunning_log", "customer")
