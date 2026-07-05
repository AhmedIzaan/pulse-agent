"""add email_digest to interest_profiles

Revision ID: a7c31f0d92e4
Revises: 0511e499cafe
Create Date: 2026-07-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c31f0d92e4'
down_revision: Union[str, None] = '0511e499cafe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'interest_profiles',
        sa.Column('email_digest', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('interest_profiles', 'email_digest')
