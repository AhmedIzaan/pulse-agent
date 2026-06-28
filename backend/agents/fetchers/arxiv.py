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
        articles.append(RawArticle(
            url=link,
            title=entry.get("title", "").replace("\n", " ").strip(),
            raw_content=entry.get("summary"),
            source="arxiv",
            published_at=entry.get("published"),
            content_hash=None,
            db_id=None,
            pinecone_id=None,
        ))
    return articles


async def arxiv_fetch(queries: list[str]) -> list[RawArticle]:
    articles: list[RawArticle] = []
    loop = asyncio.get_event_loop()
    for query in queries[:3]:
        url = (
            f"http://export.arxiv.org/api/query"
            f"?search_query=all:{query}"
            f"&max_results=15&sortBy=submittedDate&sortOrder=descending"
        )
        try:
            results = await loop.run_in_executor(None, partial(_parse_feed, url))
            articles.extend(results)
        except Exception:
            continue
    return articles
