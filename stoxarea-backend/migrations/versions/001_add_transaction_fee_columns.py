"""Add fee and net_value columns to transactions table

Revision ID: 001
Revises: 
Create Date: 2026-05-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tambah kolom fee dengan default 0.0
    op.add_column('transactions', sa.Column('fee', sa.Float(), nullable=False, server_default='0.0'))
    
    # Tambah kolom net_value dengan default 0.0
    op.add_column('transactions', sa.Column('net_value', sa.Float(), nullable=False, server_default='0.0'))
    
    # Hapus server_default setelah kolom sudah ada
    op.alter_column('transactions', 'fee', existing_type=sa.Float(), server_default=None)
    op.alter_column('transactions', 'net_value', existing_type=sa.Float(), server_default=None)


def downgrade() -> None:
    # Rollback: hapus kolom
    op.drop_column('transactions', 'net_value')
    op.drop_column('transactions', 'fee')
