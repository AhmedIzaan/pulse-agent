"""add paused to interest_profiles

Revision ID: c9d14ae06b52
Revises: b3e82c1f47d9
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d14ae06b52'
down_revision: Union[str, None] = 'b3e82c1f47d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'interest_profiles',
        sa.Column('paused', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('interest_profiles', 'paused')
