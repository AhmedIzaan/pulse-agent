import asyncio
import hmac
import logging
from datetime import datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy import select

from core.auth import get_current_user
from core.config import settings
from db.models import Digest, InterestProfile, User
from db.session import AsyncSessionLocal
from scheduler.cleanup import purge_expired_archives

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


def _local_now(tz_name: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz_name or "UTC"))
    except Exception as exc:
        # A silent UTC fallback here once shifted every user's schedule by
        # their UTC offset (missing tzdata on the server) — never hide this.
        logger.error(
            "Timezone %r failed to load (%s) — falling back to UTC; "
            "per-user schedules will be WRONG until fixed (is tzdata installed?)",
            tz_name, exc,
        )
        return datetime.now(dt_timezone.utc)


def _is_delivery_day(delivery_days: str, tz_name: str) -> bool:
    """Whether today (in the user's timezone) is one of their scheduled days."""
    now = _local_now(tz_name)
    today_code = _WEEKDAY_CODES[now.weekday()]
    days = [d.strip() for d in (delivery_days or "").split(",") if d.strip()]
    return today_code in days if days else True


def _is_delivery_hour(delivery_time: time | None, tz_name: str) -> bool:
    """Whether the current hour (in the user's timezone) matches their chosen
    delivery hour. The cron fires once per hour, so an hour-granularity match
    is exactly one trigger per day — matching minutes would risk missing the
    window entirely if the cron and the profile disagree by even a minute."""
    target_hour = delivery_time.hour if delivery_time else 8
    return _local_now(tz_name).hour == target_hour


# A "processing" digest younger than this is presumed to be an active run
# (guards against a duplicate cron trigger racing an in-flight pipeline);
# older than this, it is presumed crashed and safe to retry.
_STALE_PROCESSING_MINUTES = 15


async def _already_handled_today(db, user_id: str) -> bool:
    result = await db.execute(
        select(Digest).where(Digest.user_id == user_id).order_by(Digest.date.desc()).limit(1)
    )
    digest = result.scalar_one_or_none()
    if digest is None:
        return False
    if digest.date != datetime.now(dt_timezone.utc).date():
        return False
    if digest.status == "delivered":
        return True
    if digest.status == "processing":
        updated_at = digest.updated_at
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=dt_timezone.utc)
        age = datetime.now(dt_timezone.utc) - updated_at
        return age < timedelta(minutes=_STALE_PROCESSING_MINUTES)
    return False


async def _run_all_pipelines() -> None:
    """Run the pipeline for every user whose schedule says now, exactly once."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User, InterestProfile).join(
                InterestProfile, InterestProfile.user_id == User.id
            )
        )
        rows = result.all()

        paused_count = 0
        wrong_day_count = 0
        wrong_hour_count = 0
        already_done_count = 0
        clerk_ids: list[str] = []

        for user, profile in rows:
            if profile.paused:
                paused_count += 1
                continue
            if not _is_delivery_day(profile.delivery_days, profile.timezone):
                wrong_day_count += 1
                continue
            if not _is_delivery_hour(profile.delivery_time, profile.timezone):
                wrong_hour_count += 1
                continue
            if await _already_handled_today(db, user.id):
                already_done_count += 1
                continue
            clerk_ids.append(user.clerk_user_id)

    logger.info(
        "Cron: running pipeline for %d users "
        "(skipped: %d paused, %d wrong day, %d wrong hour, %d already delivered today)",
        len(clerk_ids), paused_count, wrong_day_count, wrong_hour_count, already_done_count,
    )
    await asyncio.gather(*[_run_pipeline(cid) for cid in clerk_ids], return_exceptions=True)

    # Archive retention: keep only yesterday's digest, purge everything older
    try:
        await purge_expired_archives()
    except Exception:
        logger.exception("Cron: archive purge failed — will retry next tick")


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
