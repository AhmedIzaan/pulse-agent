import asyncio
from functools import partial

import feedparser

from agents.state import RawArticle


def _parse_feed(url: str) -> list[RawArticle]:
    feed = feedparser.parse(url)
    articles: list[RawArticle] = []
    for entry in feed.entries:
        link = entry.get("link", "")
        if not link:
            continue
        content = (
            entry.get("content", [{}])[0].get("value")
            or entry.get("summary")
        )
        articles.append(RawArticle(
            url=link,
            title=entry.get("title", ""),
            raw_content=content,
            source="rss",
            published_at=entry.get("published"),
            content_hash=None,
            db_id=None,
            pinecone_id=None,
        ))
    return articles


async def rss_fetch(feed_urls: list[str]) -> list[RawArticle]:
    articles: list[RawArticle] = []
    loop = asyncio.get_event_loop()
    for url in feed_urls[:5]:
        try:
            results = await loop.run_in_executor(None, partial(_parse_feed, url))
            articles.extend(results)
        except Exception:
            continue
    return articles
