"""passos da esteira de marketing, com tempo e custo por agente

Revision ID: 012_marketing_agent_steps
Revises: 011_marketing_agent
"""

from alembic import op
import sqlalchemy as sa

revision = "012_marketing_agent_steps"
down_revision = "011_marketing_agent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "marketing_agent_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), nullable=False, index=True),
        sa.Column("content_id", sa.Integer(), nullable=True, index=True),
        sa.Column("agent", sa.String(length=40), nullable=False, index=True),
        sa.Column("sequence", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
        sa.Column("provider", sa.String(length=30), nullable=False, server_default=""),
        sa.Column("model", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("images", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cost_measured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("error_message", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("marketing_agent_steps")
