import feedparser
import httpx

from agents.state import RawArticle

_HEADERS = {"User-Agent": "PulseDigestBot/1.0"}


def _parse_content(content: str) -> list[RawArticle]:
    feed = feedparser.parse(content)
    articles: list[RawArticle] = []
    for entry in feed.entries:
        link = entry.get("link", "")
        if not link:
            continue
        raw_content = (
            entry.get("content", [{}])[0].get("value")
            or entry.get("summary")
        )
        articles.append(RawArticle(
            url=link,
            title=entry.get("title", ""),
            raw_content=raw_content,
            source="rss",
            published_at=entry.get("published"),
            content_hash=None,
            db_id=None,
            pinecone_id=None,
        ))
    return articles


async def rss_fetch(feed_urls: list[str]) -> list[RawArticle]:
    articles: list[RawArticle] = []
    async with httpx.AsyncClient(timeout=8, headers=_HEADERS, follow_redirects=True) as client:
        for url in feed_urls[:5]:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                articles.extend(_parse_content(resp.text))
            except Exception:
                continue
    return articles
