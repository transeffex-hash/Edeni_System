"""product and unit barcodes

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-10-18 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'g7h8i9j0k1l2'
down_revision = 'f6g7h8i9j0k1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('barcode', sa.String(length=64), nullable=True))
    op.add_column('product_units', sa.Column('barcode', sa.String(length=64), nullable=True))
    # A barcode must be unique within a business (NULLs are allowed and ignored).
    op.create_index(
        'ux_products_business_barcode', 'products', ['business_id', 'barcode'],
        unique=True, postgresql_where=sa.text('barcode IS NOT NULL'),
    )
    op.create_index(
        'ux_product_units_business_barcode', 'product_units', ['business_id', 'barcode'],
        unique=True, postgresql_where=sa.text('barcode IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ux_product_units_business_barcode', table_name='product_units')
    op.drop_index('ux_products_business_barcode', table_name='products')
    op.drop_column('product_units', 'barcode')
    op.drop_column('products', 'barcode')
