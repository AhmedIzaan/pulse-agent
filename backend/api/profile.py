from datetime import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from db.models import InterestProfile, User
from db.session import get_db

router = APIRouter(prefix="/api")

WEEKDAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class ProfileRequest(BaseModel):
    interests: str = Field(..., max_length=2000)
    delivery_time: str = Field("08:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    timezone: str = Field("UTC", max_length=64)
    email_digest: bool = False
    email: str | None = Field(None, max_length=255)  # Clerk primary email, for digest delivery
    delivery_days: list[str] = Field(default_factory=lambda: list(WEEKDAY_CODES))
    paused: bool = False

    @field_validator("delivery_days")
    @classmethod
    def validate_days(cls, v: list[str]) -> list[str]:
        cleaned = [d.lower().strip() for d in v]
        if not cleaned:
            raise ValueError("Select at least one delivery day")
        invalid = [d for d in cleaned if d not in WEEKDAY_CODES]
        if invalid:
            raise ValueError(f"Invalid day codes: {invalid}")
        # store in canonical weekday order, deduplicated
        return [d for d in WEEKDAY_CODES if d in cleaned]


async def _get_or_create_user(clerk_user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(clerk_user_id=clerk_user_id)
        db.add(user)
        await db.flush()
    return user


@router.post("/profile")
async def upsert_profile(
    body: ProfileRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_or_create_user(clerk_user_id, db)

    # Keep the user's email current — needed for digest delivery
    if body.email:
        user.email = body.email

    result = await db.execute(
        select(InterestProfile).where(InterestProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    h, m = body.delivery_time.split(":")
    dt = time(int(h), int(m))

    days_csv = ",".join(body.delivery_days)

    if profile is None:
        profile = InterestProfile(
            user_id=user.id,
            interests=body.interests,
            delivery_time=dt,
            timezone=body.timezone,
            email_digest=body.email_digest,
            delivery_days=days_csv,
            paused=body.paused,
        )
        db.add(profile)
    else:
        profile.interests = body.interests
        profile.delivery_time = dt
        profile.timezone = body.timezone
        profile.email_digest = body.email_digest
        profile.delivery_days = days_csv
        profile.paused = body.paused

    await db.commit()
    await db.refresh(profile)

    return {
        "id": profile.id,
        "clerk_user_id": clerk_user_id,
        "interests": profile.interests,
        "delivery_time": profile.delivery_time.strftime("%H:%M"),
        "timezone": profile.timezone,
        "email_digest": profile.email_digest,
        "delivery_days": profile.delivery_days.split(","),
        "paused": profile.paused,
        "updated_at": profile.updated_at.isoformat(),
    }


@router.get("/profile")
async def get_profile(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    result = await db.execute(
        select(InterestProfile).where(InterestProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return {
        "id": profile.id,
        "clerk_user_id": clerk_user_id,
        "interests": profile.interests,
        "delivery_time": profile.delivery_time.strftime("%H:%M"),
        "timezone": profile.timezone,
        "email_digest": profile.email_digest,
        "delivery_days": profile.delivery_days.split(","),
        "paused": profile.paused,
        "created_at": profile.created_at.isoformat(),
        "updated_at": profile.updated_at.isoformat(),
    }
