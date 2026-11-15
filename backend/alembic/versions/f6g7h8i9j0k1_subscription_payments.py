"""subscription start date + payments history

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-10-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'f6g7h8i9j0k1'
down_revision = 'e5f6g7h8i9j0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('businesses', sa.Column('subscription_start_date', sa.Date(), nullable=True))
    op.create_table(
        'subscription_payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_subscription_payments_business_id', 'subscription_payments', ['business_id'])


def downgrade() -> None:
    op.drop_index('ix_subscription_payments_business_id', table_name='subscription_payments')
    op.drop_table('subscription_payments')
    op.drop_column('businesses', 'subscription_start_date')
