import hashlib
from datetime import datetime

from sqlalchemy import select

from agents.state import PipelineState, RawArticle
from db.models import Article
from db.session import AsyncSessionLocal


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


async def store_raw(state: PipelineState) -> dict:
    raw_articles = state.get("raw_articles", [])
    user_id = state.get("user_id", "")
    errors: list[str] = []

    if not raw_articles:
        return {"errors": ["No articles to store"], "raw_articles": []}

    enriched: list[RawArticle] = []

    async with AsyncSessionLocal() as db:
        for article in raw_articles:
            url = article["url"]
            content_hash = _content_hash(article)

            # Skip if URL already stored for this user
            result = await db.execute(
                select(Article).where(
                    Article.user_id == user_id,
                    Article.url == url,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                enriched.append({**article, "db_id": existing.id, "content_hash": content_hash})
                continue

            db_article = Article(
                user_id=user_id,
                url=url,
                title=article["title"],
                raw_content=article.get("raw_content"),
                source=article["source"],
                published_at=_parse_datetime(article.get("published_at")),
                content_hash=content_hash,
            )
            db.add(db_article)
            try:
                await db.flush()
                enriched.append({**article, "db_id": db_article.id, "content_hash": content_hash})
            except Exception as exc:
                await db.rollback()
                errors.append(f"Failed to store {url}: {exc}")
                continue

        await db.commit()

    return {"raw_articles": enriched, "errors": errors}
