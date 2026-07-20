"""add customer_id and due_date to dunning log

Revision ID: 007_dunning_log_customer_due_date
Revises: 006_create_dunning_event
"""

from alembic import op
import sqlalchemy as sa

revision = "007_dunning_log_customer_due_date"
down_revision = "006_create_dunning_event"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dunning_log", sa.Column("customer_id", sa.String(length=64), nullable=False, server_default=""))
    op.add_column("dunning_log", sa.Column("due_date", sa.String(length=20), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("dunning_log", "due_date")
    op.drop_column("dunning_log", "customer_id")
