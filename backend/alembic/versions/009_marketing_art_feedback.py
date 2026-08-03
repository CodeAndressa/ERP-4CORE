"""feedback e aprendizado das artes de story

Revision ID: 009_marketing_art_feedback
Revises: 008_marketing_content_layout
"""

from alembic import op
import sqlalchemy as sa

revision = "009_marketing_art_feedback"
down_revision = "008_marketing_content_layout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "marketing_content",
        sa.Column("headline", sa.String(length=200), nullable=False, server_default=""),
    )
    op.add_column(
        "marketing_content",
        sa.Column("revision_notes", sa.Text(), nullable=False, server_default=""),
    )
    op.create_table(
        "marketing_art_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("content_id", sa.Integer(), nullable=False, index=True),
        sa.Column("sentiment", sa.String(length=10), nullable=False, server_default="disliked"),
        sa.Column("aspects", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("headline", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("image_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )
    op.create_table(
        "marketing_art_lesson",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("copy_rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("feedback_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("marketing_art_lesson")
    op.drop_table("marketing_art_feedback")
    op.drop_column("marketing_content", "revision_notes")
    op.drop_column("marketing_content", "headline")
