"""allow reused email for soft deleted users

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-01 16:30:00.000000
"""

from alembic import op

revision = 'c3d4e5f6g7h8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make email_hash non-unique so an inactive (soft-deleted) user can be
    # re-registered with the same email while another active user keeps it.
    op.drop_index('ix_users_email_hash', table_name='users')
    op.create_index('ix_users_email_hash', 'users', ['email_hash'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_users_email_hash', table_name='users')
    op.create_index('ix_users_email_hash', 'users', ['email_hash'], unique=True)
