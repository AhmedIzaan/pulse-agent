"""add delivery_days to interest_profiles

Revision ID: b3e82c1f47d9
Revises: a7c31f0d92e4
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3e82c1f47d9'
down_revision: Union[str, None] = 'a7c31f0d92e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'interest_profiles',
        sa.Column(
            'delivery_days',
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'mon,tue,wed,thu,fri,sat,sun'"),
        ),
    )


def downgrade() -> None:
    op.drop_column('interest_profiles', 'delivery_days')
