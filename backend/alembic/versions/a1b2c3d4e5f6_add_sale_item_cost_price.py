"""add sale_item cost_price and admin device tokens

Revision ID: a1b2c3d4e5f6
Revises: 40eb67b58eca
Create Date: 2026-08-19 20:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '40eb67b58eca'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('sale_items', sa.Column('cost_price', sa.Numeric(12, 2), nullable=True))
    with op.batch_alter_table('device_tokens') as batch_op:
        batch_op.add_column(sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.alter_column('user_id', existing_type=sa.Integer(), nullable=True)
        batch_op.alter_column('business_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('device_tokens') as batch_op:
        batch_op.drop_column('is_admin')
        batch_op.alter_column('user_id', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('business_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('sale_items', 'cost_price')
