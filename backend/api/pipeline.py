import asyncio
import hmac
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select

from core.auth import get_current_user
from core.config import settings
from db.models import InterestProfile, User
from db.session import AsyncSessionLocal

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# Users whose pipeline is currently running — prevents duplicate concurrent
# runs (double LLM cost, races on the digest row) from repeat triggers.
_running: set[str] = set()


async def _run_pipeline(clerk_user_id: str) -> None:
    if clerk_user_id in _running:
        logger.info("Pipeline already running for %s — skipping", clerk_user_id)
        return
    _running.add(clerk_user_id)
    try:
        from agents.graph import build_graph

        graph = build_graph()
        result = await graph.ainvoke({
            "user_id": "",
            "clerk_user_id": clerk_user_id,
            "profile": None,
            "raw_articles": [],
            "filtered_articles": [],
            "synthesized_articles": [],
            "digest_id": None,
            "errors": [],
        })
        if result.get("errors"):
            logger.warning("Pipeline errors for %s: %s", clerk_user_id, result["errors"])
        logger.info(
            "Pipeline complete for %s — %d articles stored",
            clerk_user_id,
            len(result.get("raw_articles", [])),
        )
    finally:
        _running.discard(clerk_user_id)


@router.post("/pipeline/run", status_code=202)
async def trigger_pipeline(
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(get_current_user),
):
    if clerk_user_id in _running:
        return {"status": "already_running"}
    background_tasks.add_task(_run_pipeline, clerk_user_id)
    return {"status": "queued"}


@router.get("/pipeline/status")
async def pipeline_status(clerk_user_id: str = Depends(get_current_user)):
    """Whether a pipeline run is currently in flight for this user."""
    return {"running": clerk_user_id in _running}


_WEEKDAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _is_delivery_day(delivery_days: str, tz_name: str) -> bool:
    """Whether today (in the user's timezone) is one of their scheduled days."""
    try:
        now = datetime.now(ZoneInfo(tz_name or "UTC"))
    except Exception:
        now = datetime.now(ZoneInfo("UTC"))
    today_code = _WEEKDAY_CODES[now.weekday()]
    days = [d.strip() for d in (delivery_days or "").split(",") if d.strip()]
    return today_code in days if days else True


async def _run_all_pipelines() -> None:
    """Run the pipeline for every user whose schedule includes today."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User, InterestProfile).join(
                InterestProfile, InterestProfile.user_id == User.id
            )
        )
        rows = result.all()

    clerk_ids = [
        user.clerk_user_id
        for user, profile in rows
        if not profile.paused and _is_delivery_day(profile.delivery_days, profile.timezone)
    ]
    paused_count = sum(1 for _, p in rows if p.paused)
    skipped = len(rows) - len(clerk_ids)

    logger.info(
        "Cron: running pipeline for %d users (%d skipped — %d paused, %d not their delivery day)",
        len(clerk_ids), skipped, paused_count, skipped - paused_count,
    )
    await asyncio.gather(*[_run_pipeline(cid) for cid in clerk_ids], return_exceptions=True)


@router.post("/pipeline/cron", status_code=202)
async def trigger_cron(
    background_tasks: BackgroundTasks,
    x_cron_secret: str = Header(default=""),
):
    """Railway Cron endpoint — protected by CRON_SECRET env var."""
    if not settings.cron_secret or not hmac.compare_digest(x_cron_secret, settings.cron_secret):
        raise HTTPException(401, "Invalid cron secret")
    background_tasks.add_task(_run_all_pipelines)
    return {"status": "queued"}
