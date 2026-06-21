from fastapi import APIRouter, Depends

from core.auth import get_current_user

router = APIRouter(prefix="/api")


@router.get("/me")
async def get_me(clerk_user_id: str = Depends(get_current_user)):
    """Protected endpoint — returns the authenticated user's Clerk ID."""
    return {"clerk_user_id": clerk_user_id}
