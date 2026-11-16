"""agente de conteudo: concorrentes, posts, snapshots e rodadas

Revision ID: 011_marketing_agent
Revises: 010_external_scheduled_post_layout
"""

from alembic import op
import sqlalchemy as sa

revision = "011_marketing_agent"
down_revision = "010_external_scheduled_post_layout"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketing_competitors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=120), nullable=False, unique=True, index=True),
        sa.Column("display_name", sa.String(length=180), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("followers_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("follows_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("media_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("biography", sa.Text(), nullable=False, server_default=""),
        sa.Column("profile_picture_url", sa.String(length=600), nullable=False, server_default=""),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "marketing_competitor_posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("competitor_id", sa.Integer(), nullable=False, index=True),
        sa.Column("media_id", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("media_type", sa.String(length=30), nullable=False, server_default=""),
        sa.Column("media_product_type", sa.String(length=30), nullable=False, server_default=""),
        sa.Column("caption", sa.Text(), nullable=False, server_default=""),
        sa.Column("permalink", sa.String(length=600), nullable=False, server_default=""),
        sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comments_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_competitor_posts_media_unique",
        "marketing_competitor_posts",
        ["media_id"],
        unique=True,
    )
    op.create_table(
        "marketing_competitor_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("competitor_id", sa.Integer(), nullable=False, index=True),
        sa.Column("followers_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("media_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )
    op.create_table(
        "marketing_agent_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="running", index=True),
        sa.Column("trigger", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("benchmark_json", sa.Text(), nullable=False, server_default=""),
        sa.Column("diagnosis_json", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_content_ids", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("error_message", sa.Text(), nullable=False, server_default=""),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("marketing_agent_runs")
    op.drop_table("marketing_competitor_snapshots")
    op.drop_index("ix_competitor_posts_media_unique", table_name="marketing_competitor_posts")
    op.drop_table("marketing_competitor_posts")
    op.drop_table("marketing_competitors")
