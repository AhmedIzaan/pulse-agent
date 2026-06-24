from datetime import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from db.models import InterestProfile, User
from db.session import get_db

router = APIRouter(prefix="/api")


class ProfileRequest(BaseModel):
    interests: str = Field(..., max_length=2000)
    delivery_time: str = Field("08:00", pattern=r"^\d{2}:\d{2}$")
    timezone: str = Field("UTC", max_length=64)


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

    result = await db.execute(
        select(InterestProfile).where(InterestProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    h, m = body.delivery_time.split(":")
    dt = time(int(h), int(m))

    if profile is None:
        profile = InterestProfile(
            user_id=user.id,
            interests=body.interests,
            delivery_time=dt,
            timezone=body.timezone,
        )
        db.add(profile)
    else:
        profile.interests = body.interests
        profile.delivery_time = dt
        profile.timezone = body.timezone

    await db.commit()
    await db.refresh(profile)

    return {
        "id": profile.id,
        "clerk_user_id": clerk_user_id,
        "interests": profile.interests,
        "delivery_time": profile.delivery_time.strftime("%H:%M"),
        "timezone": profile.timezone,
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
        "created_at": profile.created_at.isoformat(),
        "updated_at": profile.updated_at.isoformat(),
    }
