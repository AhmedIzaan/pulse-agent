import asyncio
import hashlib
import logging
from datetime import date, datetime, timedelta, timezone

from pinecone import Pinecone
from sqlalchemy import select, update

from agents.state import PipelineState, RawArticle
from core.config import settings
from db.models import Article, Digest
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _content_hash(article: RawArticle) -> str:
    content = article.get("raw_content") or article["url"]
    return hashlib.sha256(content.encode()).hexdigest()


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
    ):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def _embed_texts(texts: list[str]) -> list[list[float]]:
    # Pinecone inference API caps batches at 96 inputs
    pc = Pinecone(api_key=settings.pinecone_api_key)
    embeddings: list[list[float]] = []
    for i in range(0, len(texts), 96):
        result = pc.inference.embed(
            model="multilingual-e5-large",
            inputs=texts[i:i + 96],
            parameters={"input_type": "passage"},
        )
        embeddings.extend(r.values for r in result)
    return embeddings


async def _upsert_to_pinecone(articles: list[RawArticle], user_id: str) -> dict[str, str]:
    """Returns mapping of db_id → pinecone_id for successfully upserted articles."""
    if not articles:
        return {}

    texts = [
        f"{a['title']} {(a.get('raw_content') or '')[:500]}"
        for a in articles
    ]

    loop = asyncio.get_event_loop()
    try:
        embeddings = await loop.run_in_executor(None, _embed_texts, texts)
    except Exception as exc:
        logger.warning("store_raw: embedding failed, skipping Pinecone: %s", exc)
        return {}

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)

    vectors = []
    id_map: dict[str, str] = {}
    for article, embedding in zip(articles, embeddings):
        db_id = article.get("db_id", "")
        pinecone_id = f"{user_id}_{db_id}"
        vectors.append({
            "id": pinecone_id,
            "values": embedding,
            "metadata": {
                "article_id": db_id,
                "user_id": user_id,
                "url": article["url"],
                "source": article["source"],
            },
        })
        id_map[db_id] = pinecone_id

    try:
        for i in range(0, len(vectors), 100):
            batch = vectors[i:i + 100]
            await loop.run_in_executor(None, lambda b=batch: index.upsert(vectors=b))
    except Exception as exc:
        logger.warning("store_raw: Pinecone upsert failed: %s", exc)
        return {}

    return id_map


async def _prune_old_vectors(user_id: str) -> None:
    """Delete Pinecone vectors older than one day (free-tier storage limit).

    Only the vectors go — the DB rows stay for the archive and for
    cross-day dedup, which work off Postgres, not Pinecone.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Article.id, Article.pinecone_id).where(
                Article.user_id == user_id,
                Article.pinecone_id.is_not(None),
                Article.fetched_at < cutoff,
            )
        )
        rows = result.all()
        if not rows:
            return

        pc = Pinecone(api_key=settings.pinecone_api_key)
        index = pc.Index(settings.pinecone_index_name)
        pinecone_ids = [pid for _, pid in rows]

        loop = asyncio.get_event_loop()
        try:
            for i in range(0, len(pinecone_ids), 100):
                chunk = pinecone_ids[i:i + 100]
                await loop.run_in_executor(None, lambda c=chunk: index.delete(ids=c))
        except Exception as exc:
            logger.warning("store_raw: Pinecone prune failed (will retry next run): %s", exc)
            return

        await db.execute(
            update(Article)
            .where(Article.id.in_([aid for aid, _ in rows]))
            .values(pinecone_id=None)
        )
        await db.commit()
        logger.info("store_raw: pruned %d old vectors from Pinecone", len(pinecone_ids))


async def store_raw(state: PipelineState) -> dict:
    raw_articles = state.get("raw_articles", [])
    user_id = state.get("user_id", "")
    errors: list[str] = []

    if not raw_articles:
        logger.warning("store_raw: no articles to store")
        return {"errors": ["No articles to store"], "raw_articles": []}

    # Drop anything without an http(s) URL — these end up as links in the
    # dashboard and email, so no other schemes get stored.
    valid = [a for a in raw_articles if a["url"].startswith(("http://", "https://"))]
    if len(valid) < len(raw_articles):
        logger.info("store_raw: dropped %d articles with non-http URLs", len(raw_articles) - len(valid))

    logger.info("[3/6] store_raw: storing %d articles + embedding to Pinecone", len(valid))
    enriched: list[RawArticle] = []

    hashes = {a["url"]: _content_hash(a) for a in valid}
    today = date.today()

    async with AsyncSessionLocal() as db:
        # One batched lookup instead of a round-trip per article. The digest
        # join tells us which of these were already delivered on an earlier
        # day — those are excluded so users never see the same entry twice
        # (and so today's run can't steal an article out of a past digest).
        result = await db.execute(
            select(Article, Digest.date)
            .outerjoin(Digest, Article.digest_id == Digest.id)
            .where(
                Article.user_id == user_id,
                (Article.url.in_(list(hashes)))
                | (Article.content_hash.in_(list(hashes.values()))),
            )
        )
        existing_by_url: dict[str, Article] = {}
        delivered_urls: set[str] = set()
        delivered_hashes: set[str] = set()
        for db_article, digest_date in result.all():
            if digest_date is not None and digest_date < today:
                delivered_urls.add(db_article.url)
                if db_article.content_hash:
                    delivered_hashes.add(db_article.content_hash)
            else:
                existing_by_url[db_article.url] = db_article

        pending: list[tuple[RawArticle, Article, str]] = []
        skipped_delivered = 0
        for article in valid:
            content_hash = hashes[article["url"]]
            if article["url"] in delivered_urls or content_hash in delivered_hashes:
                skipped_delivered += 1
                continue
            existing = existing_by_url.get(article["url"])
            if existing:
                enriched.append({
                    **article,
                    "db_id": existing.id,
                    "pinecone_id": existing.pinecone_id,
                    "content_hash": content_hash,
                })
                continue

            db_article = Article(
                user_id=user_id,
                url=article["url"],
                title=article["title"],
                raw_content=article.get("raw_content"),
                source=article["source"],
                published_at=_parse_datetime(article.get("published_at")),
                content_hash=content_hash,
            )
            db.add(db_article)
            pending.append((article, db_article, content_hash))

        if skipped_delivered:
            logger.info(
                "store_raw: skipped %d articles already delivered in past digests",
                skipped_delivered,
            )

        try:
            await db.flush()
            for article, db_article, content_hash in pending:
                enriched.append({**article, "db_id": db_article.id, "content_hash": content_hash})
            await db.commit()
        except Exception as exc:
            await db.rollback()
            errors.append(f"Failed to store new articles: {exc}")

    # Upsert new articles to Pinecone (only those with a fresh db_id)
    new_articles = [a for a in enriched if a.get("db_id") and not a.get("pinecone_id")]
    logger.info("store_raw: embedding %d new articles to Pinecone", len(new_articles))
    pinecone_map = await _upsert_to_pinecone(new_articles, user_id)

    # Attach pinecone_ids and update DB records
    if pinecone_map:
        async with AsyncSessionLocal() as db:
            for article in new_articles:
                pid = pinecone_map.get(article.get("db_id", ""))
                if pid:
                    article["pinecone_id"] = pid
                    result = await db.execute(
                        select(Article).where(Article.id == article["db_id"])
                    )
                    db_article = result.scalar_one_or_none()
                    if db_article:
                        db_article.pinecone_id = pid
            await db.commit()

    # Free-tier housekeeping: drop vectors older than a day
    try:
        await _prune_old_vectors(user_id)
    except Exception as exc:
        logger.warning("store_raw: vector prune skipped: %s", exc)

    logger.info("store_raw: done — %d stored, %d errors", len(enriched), len(errors))
    return {"raw_articles": enriched, "errors": errors}
