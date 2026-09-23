"""add user password hash for local auth

Revision ID: 0002_user_password
Revises: 0001_core
Create Date: 2026-09-23
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_user_password"
down_revision = "0001_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
