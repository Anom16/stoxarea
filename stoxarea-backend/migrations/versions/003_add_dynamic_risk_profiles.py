"""Add dynamic risk profiles table and alter users table

Revision ID: 003
Revises: 002
Create Date: 2026-07-05 17:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create risk_profiles table
    op.create_table(
        'risk_profiles',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('ai_score_weight', sa.Float(), nullable=False, server_default='0.25'),
        sa.Column('roe_weight', sa.Float(), nullable=False, server_default='0.25'),
        sa.Column('der_weight', sa.Float(), nullable=False, server_default='0.25'),
        sa.Column('pbv_weight', sa.Float(), nullable=False, server_default='0.25'),
        sa.Column('min_score_threshold', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_score_threshold', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )

    # 2. Seed default risk profiles
    risk_profiles_table = table(
        'risk_profiles',
        column('id', sa.String),
        column('name', sa.String),
        column('description', sa.String),
        column('ai_score_weight', sa.Float),
        column('roe_weight', sa.Float),
        column('der_weight', sa.Float),
        column('pbv_weight', sa.Float),
        column('min_score_threshold', sa.Integer),
        column('max_score_threshold', sa.Integer)
    )

    op.bulk_insert(
        risk_profiles_table,
        [
            {
                'id': 'konservatif',
                'name': 'Konservatif',
                'description': 'Fokus pada keamanan modal dengan emiten berfundamental kuat.',
                'ai_score_weight': 0.10,
                'roe_weight': 0.45,
                'der_weight': 0.35,
                'pbv_weight': 0.10,
                'min_score_threshold': 0,
                'max_score_threshold': 11
            },
            {
                'id': 'moderat',
                'name': 'Moderat',
                'description': 'Menyeimbangkan pertumbuhan momentum AI dengan stabilitas fundamental.',
                'ai_score_weight': 0.35,
                'roe_weight': 0.30,
                'der_weight': 0.15,
                'pbv_weight': 0.20,
                'min_score_threshold': 12,
                'max_score_threshold': 18
            },
            {
                'id': 'agresif',
                'name': 'Agresif',
                'description': 'Memaksimalkan pengembalian dengan memanfaatkan rekomendasi kecerdasan AI.',
                'ai_score_weight': 0.60,
                'roe_weight': 0.10,
                'der_weight': 0.10,
                'pbv_weight': 0.20,
                'min_score_threshold': 19,
                'max_score_threshold': 25
            }
        ]
    )

    # 3. Drop indexes from users table that depend on risk_profile
    op.drop_index('idx_users_risk_profile', table_name='users', if_exists=True)
    op.drop_index('idx_users_email_profile', table_name='users', if_exists=True)

    # 4. Alter users.risk_profile column type to VARCHAR(50)
    # We do a PostgreSQL CAST using USING clause to avoid Type conversion errors
    op.execute("ALTER TABLE users ALTER COLUMN risk_profile TYPE VARCHAR(50) USING risk_profile::VARCHAR(50)")

    # 5. Clean up string case values in users table to lowercase to match primary key IDs
    # Mapping 'Konservatif' -> 'konservatif', etc.
    op.execute("UPDATE users SET risk_profile = 'konservatif' WHERE LOWER(risk_profile) = 'konservatif'")
    op.execute("UPDATE users SET risk_profile = 'moderat' WHERE LOWER(risk_profile) = 'moderat'")
    op.execute("UPDATE users SET risk_profile = 'agresif' WHERE LOWER(risk_profile) = 'agresif'")

    # 6. Re-create the indexes
    op.create_index('idx_users_risk_profile', 'users', ['risk_profile'], if_not_exists=True)
    op.create_index('idx_users_email_profile', 'users', ['email', 'risk_profile'], if_not_exists=True)


def downgrade() -> None:
    # 1. Drop indexes
    op.drop_index('idx_users_risk_profile', table_name='users', if_exists=True)
    op.drop_index('idx_users_email_profile', table_name='users', if_exists=True)

    # 2. Revert column back to VARCHAR/Enum format (Keep as VARCHAR(50) for simplicity in downgrading)
    op.execute("UPDATE users SET risk_profile = 'Konservatif' WHERE risk_profile = 'konservatif'")
    op.execute("UPDATE users SET risk_profile = 'Moderat' WHERE risk_profile = 'moderat'")
    op.execute("UPDATE users SET risk_profile = 'Agresif' WHERE risk_profile = 'agresif'")

    # 3. Re-create indexes
    op.create_index('idx_users_risk_profile', 'users', ['risk_profile'], if_not_exists=True)
    op.create_index('idx_users_email_profile', 'users', ['email', 'risk_profile'], if_not_exists=True)

    # 4. Drop risk_profiles table
    op.drop_table('risk_profiles')
