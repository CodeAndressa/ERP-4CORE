"""add layout to marketing content (feed vs story)

Revision ID: 008_marketing_content_layout
Revises: 007_dunning_log_customer_due_date
"""

from alembic import op
import sqlalchemy as sa

revision = "008_marketing_content_layout"
down_revision = "007_dunning_log_customer_due_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "marketing_content",
        sa.Column("layout", sa.String(length=20), nullable=False, server_default="feed"),
    )


def downgrade() -> None:
    op.drop_column("marketing_content", "layout")
