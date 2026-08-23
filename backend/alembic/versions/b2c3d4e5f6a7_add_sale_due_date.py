"""add sale due_date

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-21 09:55:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sales', sa.Column('due_date', sa.Date(), nullable=True))
    op.create_index('ix_sales_due_date', 'sales', ['due_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_sales_due_date', table_name='sales')
    op.drop_column('sales', 'due_date')
