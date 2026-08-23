"""add selling_price voided_fields subscription_end_date

Revision ID: 40eb67b58eca
Revises: 2ef42c2ccbf0
Create Date: 2026-08-09 10:22:04.507043
"""

from alembic import op
import sqlalchemy as sa

revision = '40eb67b58eca'
down_revision = '2ef42c2ccbf0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Business: add subscription_end_date
    op.add_column('businesses', sa.Column('subscription_end_date', sa.Date(), nullable=True))

    # ProductUnit: add selling_price (optional default price per unit)
    op.add_column('product_units', sa.Column('selling_price', sa.Numeric(precision=12, scale=2), nullable=True))

    # Sale: add void/reversal tracking fields
    op.add_column('sales', sa.Column('is_voided', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('sales', sa.Column('voided_by_user_id', sa.Integer(), nullable=True))
    op.add_column('sales', sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sales', sa.Column('void_reason', sa.String(length=500), nullable=True))
    op.create_foreign_key('fk_sales_voided_by_user_id', 'sales', 'users', ['voided_by_user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_sales_voided_by_user_id', 'sales', type_='foreignkey')
    op.drop_column('sales', 'void_reason')
    op.drop_column('sales', 'voided_at')
    op.drop_column('sales', 'voided_by_user_id')
    op.drop_column('sales', 'is_voided')
    op.drop_column('product_units', 'selling_price')
    op.drop_column('businesses', 'subscription_end_date')
