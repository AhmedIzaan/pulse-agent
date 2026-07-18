"""Archive retention — the archive holds at most the previous day's digest.

Runs on every hourly cron tick: digests older than yesterday (UTC) are
deleted, along with their articles and any vectors those articles still
hold in Pinecone (free-tier storage cap).

Articles the user reacted to (thumbs / clicks) are kept as slim rows —
title only, heavy content stripped — because the filter agent builds its
taste signals from those titles.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from pinecone import Pinecone
from sqlalchemy import delete, exists, or_, select, update

from core.config import settings
from db.models import Article, ArticleClick, ArticleFeedback, Digest
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

# Days of archive kept behind today: 1 = today's digest plus yesterday's.
RETENTION_DAYS = 1


async def purge_expired_archives() -> None:
    now = datetime.now(timezone.utc)
    cutoff_date = now.date() - timedelta(days=RETENTION_DAYS)
    # Articles that never joined a digest get one extra day so an in-flight
    # run's freshly stored rows are never swept mid-pipeline.
    leftover_cutoff = now - timedelta(days=RETENTION_DAYS + 1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Digest.id).where(Digest.date < cutoff_date))
        old_digest_ids = [r[0] for r in result]

        expired = or_(
            Article.digest_id.in_(old_digest_ids),
            (Article.digest_id.is_(None)) & (Article.fetched_at < leftover_cutoff),
        )
        has_signal = exists().where(ArticleFeedback.article_id == Article.id) | exists().where(
            ArticleClick.article_id == Article.id
        )

        # Vectors go first: once the rows are deleted the pinecone_ids are
        # lost forever, so if Pinecone won't delete, abort and let the next
        # hourly tick retry. (Usually a no-op — store_raw prunes vectors
        # after a day on its own.)
        result = await db.execute(
            select(Article.pinecone_id).where(expired, Article.pinecone_id.is_not(None))
        )
        pinecone_ids = [r[0] for r in result]
        if pinecone_ids:
            try:
                index = Pinecone(api_key=settings.pinecone_api_key).Index(
                    settings.pinecone_index_name
                )
                loop = asyncio.get_event_loop()
                for i in range(0, len(pinecone_ids), 100):
                    chunk = pinecone_ids[i:i + 100]
                    await loop.run_in_executor(None, lambda c=chunk: index.delete(ids=c))
            except Exception as exc:
                logger.warning("cleanup: Pinecone delete failed, retrying next tick: %s", exc)
                return

        # Hard-delete expired articles nobody reacted to (feedback and click
        # rows cascade at the DB level)…
        result = await db.execute(
            delete(Article)
            .where(expired, ~has_signal)
            .execution_options(synchronize_session=False)
        )
        deleted_articles = result.rowcount
        # …and slim the reacted-to ones down to what the filter needs.
        result = await db.execute(
            update(Article)
            .where(expired, has_signal)
            .values(
                digest_id=None,
                raw_content=None,
                summary=None,
                why_it_matters=None,
                pinecone_id=None,
            )
            .execution_options(synchronize_session=False)
        )
        slimmed = result.rowcount

        await db.execute(delete(Digest).where(Digest.id.in_(old_digest_ids)))
        await db.commit()

    if old_digest_ids or deleted_articles or slimmed:
        logger.info(
            "cleanup: purged %d digests — %d articles deleted, %d kept slim for taste signals",
            len(old_digest_ids), deleted_articles, slimmed,
        )
