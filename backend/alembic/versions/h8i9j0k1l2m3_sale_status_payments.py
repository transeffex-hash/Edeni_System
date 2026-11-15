"""sale status (drafts) + sale payments

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-10-18 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sales', sa.Column('status', sa.String(length=16), nullable=False, server_default='paid'))
    op.add_column('sales', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_sales_status', 'sales', ['status'])

    op.create_table(
        'sale_payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id'), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        # Reuse the existing paymentmethod enum type created for sales.payment_method
        sa.Column('method', postgresql.ENUM('cash', 'momo', name='paymentmethod', create_type=False), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('note', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_sale_payments_business_id', 'sale_payments', ['business_id'])
    op.create_index('ix_sale_payments_sale_id', 'sale_payments', ['sale_id'])

    # Backfill: every existing completed, non-credit sale was paid in full at creation.
    op.execute(
        """
        INSERT INTO sale_payments (business_id, sale_id, created_by_user_id, method, amount, created_at)
        SELECT business_id, id, created_by_user_id, payment_method, total_amount, created_at
        FROM sales
        WHERE is_credit = false AND is_voided = false
        """
    )


def downgrade() -> None:
    op.drop_index('ix_sale_payments_sale_id', table_name='sale_payments')
    op.drop_index('ix_sale_payments_business_id', table_name='sale_payments')
    op.drop_table('sale_payments')
    op.drop_index('ix_sales_status', table_name='sales')
    op.drop_column('sales', 'updated_at')
    op.drop_column('sales', 'status')
