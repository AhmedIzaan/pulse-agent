import logging

from sqlalchemy import select

from agents.state import PipelineState, ProfileData
from db.models import InterestProfile, User
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def load_profile(state: PipelineState) -> dict:
    clerk_user_id = state["clerk_user_id"]
    logger.info("[1/6] load_profile: looking up %s", clerk_user_id)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.clerk_user_id == clerk_user_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            logger.warning("load_profile: user not found: %s", clerk_user_id)
            return {"errors": [f"User not found: {clerk_user_id}"]}

        result = await db.execute(
            select(InterestProfile).where(InterestProfile.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            logger.warning("load_profile: no interest profile for %s", clerk_user_id)
            return {"errors": ["No interest profile found — complete onboarding first"]}

        logger.info("load_profile: loaded profile for user_id=%s", user.id)
        return {
            "user_id": user.id,
            "profile": ProfileData(
                id=profile.id,
                user_id=profile.user_id,
                interests=profile.interests,
                delivery_time=str(profile.delivery_time),
                timezone=profile.timezone,
            ),
        }
