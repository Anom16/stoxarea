"""Add database indexes and Decimal precision for transactions

Revision ID: 002
Revises: 001_add_transaction_fee_columns
Create Date: 2026-05-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add missing indexes for performance and Decimal columns for precision"""
    
    # === INDEXES ===
    # Buat index untuk created_at (berguna untuk date range queries, pagination)
    op.create_index('idx_users_created_at', 'users', ['created_at'], if_not_exists=True)
    
    # Index untuk risk_profile (berguna untuk filtering by profile)
    op.create_index('idx_users_risk_profile', 'users', ['risk_profile'], if_not_exists=True)
    
    # Composite index untuk efficient lookups
    op.create_index('idx_users_email_profile', 'users', ['email', 'risk_profile'], if_not_exists=True)
    
    # Index untuk stocks table
    op.create_index('idx_stocks_ticker', 'stocks', ['ticker'], if_not_exists=True)
    op.create_index('idx_stocks_is_qualified', 'stocks', ['is_qualified'], if_not_exists=True)
    op.create_index('idx_stocks_sector', 'stocks', ['sector'], if_not_exists=True)
    
    # Index untuk portfolios
    op.create_index('idx_portfolios_user_id', 'portfolios', ['user_id'], if_not_exists=True)
    op.create_index('idx_portfolios_ticker', 'portfolios', ['ticker'], if_not_exists=True)
    
    # Index untuk transactions (critical untuk virtual trading)
    op.create_index('idx_transactions_user_id', 'transactions', ['user_id'], if_not_exists=True)
    op.create_index('idx_transactions_timestamp', 'transactions', ['timestamp'], if_not_exists=True)
    
    # === PRECISION FIX ===
    # Drop old Float columns dan create new Numeric (Decimal) columns
    # Numeric(precision=15, scale=2) = up to 999,999,999,999.99 (13 digits + 2 decimal places)
    
    # 1. virtual_balance
    op.alter_column(
        'users', 'virtual_balance',
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=15, scale=2),
        nullable=False,
        server_default='100000000.00'
    )
    
    # 2. Transaction columns (already added in migration 001, but ensure they're Decimal)
    # IF you need to convert:
    # op.alter_column('transactions', 'price', existing_type=sa.Float(), type_=sa.Numeric(precision=15, scale=2))
    # op.alter_column('transactions', 'fee', existing_type=sa.Float(), type_=sa.Numeric(precision=15, scale=2))
    # op.alter_column('transactions', 'net_value', existing_type=sa.Float(), type_=sa.Numeric(precision=15, scale=2))


def downgrade() -> None:
    """Remove indexes and revert to Float precision"""
    
    # Drop indexes
    op.drop_index('idx_users_created_at', table_name='users', if_exists=True)
    op.drop_index('idx_users_risk_profile', table_name='users', if_exists=True)
    op.drop_index('idx_users_email_profile', table_name='users', if_exists=True)
    op.drop_index('idx_stocks_ticker', table_name='stocks', if_exists=True)
    op.drop_index('idx_stocks_is_qualified', table_name='stocks', if_exists=True)
    op.drop_index('idx_stocks_sector', table_name='stocks', if_exists=True)
    op.drop_index('idx_portfolios_user_id', table_name='portfolios', if_exists=True)
    op.drop_index('idx_portfolios_ticker', table_name='portfolios', if_exists=True)
    op.drop_index('idx_transactions_user_id', table_name='transactions', if_exists=True)
    op.drop_index('idx_transactions_timestamp', table_name='transactions', if_exists=True)
    
    # Revert precision back to Float (not recommended, but for downgrade compatibility)
    op.alter_column(
        'users', 'virtual_balance',
        existing_type=sa.Numeric(precision=15, scale=2),
        type_=sa.Float(),
        nullable=False,
        server_default='100000000.0'
    )
