"""create marketing content workflow

Revision ID: 002_create_marketing_content
Revises: 001_create_users
"""

from alembic import op
import sqlalchemy as sa

revision = "002_create_marketing_content"
down_revision = "001_create_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketing_content",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("brief", sa.Text(), nullable=False, server_default=""),
        sa.Column("caption", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("channel", sa.String(length=30), nullable=False, server_default="instagram"),
        sa.Column("format", sa.String(length=30), nullable=False, server_default="image"),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="draft"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("art_path", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("meta_container_id", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("instagram_media_id", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("facebook_post_id", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("error_message", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_marketing_content_status", "marketing_content", ["status"])
    op.create_index("ix_marketing_content_scheduled_at", "marketing_content", ["scheduled_at"])


def downgrade() -> None:
    op.drop_index("ix_marketing_content_scheduled_at", table_name="marketing_content")
    op.drop_index("ix_marketing_content_status", table_name="marketing_content")
    op.drop_table("marketing_content")
