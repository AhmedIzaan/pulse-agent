import feedparser
import httpx

from agents.state import RawArticle


def _parse_content(content: str) -> list[RawArticle]:
    feed = feedparser.parse(content)
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
    async with httpx.AsyncClient(timeout=8) as client:
        for query in queries[:3]:
            url = (
                "http://export.arxiv.org/api/query"
                f"?search_query=all:{query}"
                "&max_results=15&sortBy=submittedDate&sortOrder=descending"
            )
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                articles.extend(_parse_content(resp.text))
            except Exception:
                continue
    return articles
