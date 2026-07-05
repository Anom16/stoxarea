"""Add dynamic mappings and indicators

Revision ID: 004
Revises: 003
Create Date: 2026-07-05 17:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create stock_profile_mappings table
    op.create_table(
        'stock_profile_mappings',
        sa.Column('ticker', sa.String(length=20), nullable=False),
        sa.Column('profile_id', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('ticker', 'profile_id')
    )

    # 2. Create indicators table
    op.create_table(
        'indicators',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False), # 'benefit' | 'cost'
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )

    # 3. Create profile_indicator_weights table
    op.create_table(
        'profile_indicator_weights',
        sa.Column('profile_id', sa.String(length=50), nullable=False),
        sa.Column('indicator_id', sa.String(length=50), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('profile_id', 'indicator_id')
    )

    # 4. Create stock_indicator_values table
    op.create_table(
        'stock_indicator_values',
        sa.Column('ticker', sa.String(length=20), nullable=False),
        sa.Column('indicator_id', sa.String(length=50), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint('ticker', 'indicator_id')
    )

    # 5. Seed default indicators
    indicators_table = table(
        'indicators',
        column('id', sa.String),
        column('name', sa.String),
        column('type', sa.String),
        column('description', sa.String)
    )
    op.bulk_insert(
        indicators_table,
        [
            {'id': 'ai_score', 'name': 'AI Momentum Score', 'type': 'benefit', 'description': 'Skor probabilitas momentum kenaikan harga dari model AI XGBoost'},
            {'id': 'roe', 'name': 'ROE (Return on Equity)', 'type': 'benefit', 'description': 'Tingkat pengembalian ekuitas untuk mengukur efisiensi laba emiten'},
            {'id': 'der', 'name': 'DER (Debt to Equity Ratio)', 'type': 'cost', 'description': 'Rasio hutang terhadap ekuitas untuk menilai solvabilitas emiten'},
            {'id': 'pbv', 'name': 'PBV (Price to Book Value)', 'type': 'cost', 'description': 'Rasio harga saham terhadap nilai buku untuk mengukur valuasi emiten'}
        ]
    )

    # 6. Migrate weights from risk_profiles to profile_indicator_weights
    op.execute("""
        INSERT INTO profile_indicator_weights (profile_id, indicator_id, weight)
        SELECT id, 'ai_score', ai_score_weight FROM risk_profiles
    """)
    op.execute("""
        INSERT INTO profile_indicator_weights (profile_id, indicator_id, weight)
        SELECT id, 'roe', roe_weight FROM risk_profiles
    """)
    op.execute("""
        INSERT INTO profile_indicator_weights (profile_id, indicator_id, weight)
        SELECT id, 'der', der_weight FROM risk_profiles
    """)
    op.execute("""
        INSERT INTO profile_indicator_weights (profile_id, indicator_id, weight)
        SELECT id, 'pbv', pbv_weight FROM risk_profiles
    """)

    # 7. Drop obsolete columns from risk_profiles
    op.drop_column('risk_profiles', 'ai_score_weight')
    op.drop_column('risk_profiles', 'roe_weight')
    op.drop_column('risk_profiles', 'der_weight')
    op.drop_column('risk_profiles', 'pbv_weight')

    # 8. Migrate existing stock fundamental values to stock_indicator_values
    op.execute("""
        INSERT INTO stock_indicator_values (ticker, indicator_id, value)
        SELECT ticker, 'roe', roe FROM stocks WHERE roe IS NOT NULL
    """)
    op.execute("""
        INSERT INTO stock_indicator_values (ticker, indicator_id, value)
        SELECT ticker, 'der', der FROM stocks WHERE der IS NOT NULL
    """)
    op.execute("""
        INSERT INTO stock_indicator_values (ticker, indicator_id, value)
        SELECT ticker, 'pbv', pbv FROM stocks WHERE pbv IS NOT NULL
    """)

    # 9. Associate all existing stocks with the default profiles (backward compatibility)
    op.execute("""
        INSERT INTO stock_profile_mappings (ticker, profile_id)
        SELECT ticker, 'konservatif' FROM stocks
    """)
    op.execute("""
        INSERT INTO stock_profile_mappings (ticker, profile_id)
        SELECT ticker, 'moderat' FROM stocks
    """)
    op.execute("""
        INSERT INTO stock_profile_mappings (ticker, profile_id)
        SELECT ticker, 'agresif' FROM stocks
    """)


def downgrade() -> None:
    # 1. Re-add weight columns to risk_profiles
    op.add_column('risk_profiles', sa.Column('ai_score_weight', sa.Float(), nullable=False, server_default='0.25'))
    op.add_column('risk_profiles', sa.Column('roe_weight', sa.Float(), nullable=False, server_default='0.25'))
    op.add_column('risk_profiles', sa.Column('der_weight', sa.Float(), nullable=False, server_default='0.25'))
    op.add_column('risk_profiles', sa.Column('pbv_weight', sa.Float(), nullable=False, server_default='0.25'))

    # 2. Restore weights
    op.execute("""
        UPDATE risk_profiles rp
        SET ai_score_weight = (SELECT weight FROM profile_indicator_weights piw WHERE piw.profile_id = rp.id AND piw.indicator_id = 'ai_score')
    """)
    op.execute("""
        UPDATE risk_profiles rp
        SET roe_weight = (SELECT weight FROM profile_indicator_weights piw WHERE piw.profile_id = rp.id AND piw.indicator_id = 'roe')
    """)
    op.execute("""
        UPDATE risk_profiles rp
        SET der_weight = (SELECT weight FROM profile_indicator_weights piw WHERE piw.profile_id = rp.id AND piw.indicator_id = 'der')
    """)
    op.execute("""
        UPDATE risk_profiles rp
        SET pbv_weight = (SELECT weight FROM profile_indicator_weights piw WHERE piw.profile_id = rp.id AND piw.indicator_id = 'pbv')
    """)

    # 3. Drop new tables
    op.drop_table('stock_indicator_values')
    op.drop_table('profile_indicator_weights')
    op.drop_table('indicators')
    op.drop_table('stock_profile_mappings')
