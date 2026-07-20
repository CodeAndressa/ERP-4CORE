"""create instagram messages log

Revision ID: 003_create_instagram_messages
Revises: 002_create_marketing_content
"""

from alembic import op
import sqlalchemy as sa

revision = "003_create_instagram_messages"
down_revision = "002_create_marketing_content"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "instagram_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.String(length=64), nullable=False),
        sa.Column("sender_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("sender_username", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("direction", sa.String(length=10), nullable=False, server_default="inbound"),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("mid", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_instagram_messages_conversation_id", "instagram_messages", ["conversation_id"])
    op.create_index("ix_instagram_messages_created_at", "instagram_messages", ["created_at"])
    op.create_index("ix_instagram_messages_mid_unique", "instagram_messages", ["mid"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_instagram_messages_mid_unique", table_name="instagram_messages")
    op.drop_index("ix_instagram_messages_created_at", table_name="instagram_messages")
    op.drop_index("ix_instagram_messages_conversation_id", table_name="instagram_messages")
    op.drop_table("instagram_messages")
