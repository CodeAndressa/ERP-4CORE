"""add layout to external scheduled posts (feed vs story)

Revision ID: 010_external_scheduled_post_layout
Revises: 009_marketing_art_feedback
"""

from alembic import op
import sqlalchemy as sa

revision = "010_external_scheduled_post_layout"
down_revision = "009_marketing_art_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "external_scheduled_posts",
        sa.Column("layout", sa.String(length=20), nullable=False, server_default="feed"),
    )


def downgrade() -> None:
    op.drop_column("external_scheduled_posts", "layout")
