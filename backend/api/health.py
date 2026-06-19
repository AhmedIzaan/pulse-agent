from fastapi import APIRouter
from core.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}
