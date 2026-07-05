"""drop_corporate_action_flags

Revision ID: 71a04e9bc5d8
Revises: 004
Create Date: 2026-07-05 21:20:42.353116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '71a04e9bc5d8'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('corporate_action_flags')


def downgrade() -> None:
    op.create_table(
        'corporate_action_flags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ticker', sa.String(), nullable=False),
        sa.Column('prev_close', sa.Float(), nullable=True),
        sa.Column('curr_close', sa.Float(), nullable=True),
        sa.Column('change_pct', sa.Float(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), default=False),
        sa.Column('action_type', sa.String(), nullable=True),
        sa.Column('split_ratio', sa.Float(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )

