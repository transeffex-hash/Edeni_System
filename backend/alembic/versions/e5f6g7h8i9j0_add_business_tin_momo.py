"""add business tin and momo_code

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-10-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'e5f6g7h8i9j0'
down_revision = 'd4e5f6g7h8i9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('businesses', sa.Column('tin', sa.String(length=64), nullable=True))
    op.add_column('businesses', sa.Column('momo_code', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('businesses', 'momo_code')
    op.drop_column('businesses', 'tin')
