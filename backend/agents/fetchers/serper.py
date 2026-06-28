import httpx

from agents.state import RawArticle


async def serper_fetch(queries: list[str], api_key: str) -> list[RawArticle]:
    if not api_key:
        return []
    articles: list[RawArticle] = []
    async with httpx.AsyncClient(timeout=10) as client:
        for query in queries[:3]:
            try:
                resp = await client.post(
                    "https://google.serper.dev/news",
                    headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"q": query, "num": 15},
                )
                resp.raise_for_status()
                for item in resp.json().get("news", []):
                    url = item.get("link", "")
                    if not url:
                        continue
                    articles.append(RawArticle(
                        url=url,
                        title=item.get("title", ""),
                        raw_content=item.get("snippet"),
                        source="serper",
                        published_at=item.get("date"),
                        content_hash=None,
                        db_id=None,
                        pinecone_id=None,
                    ))
            except Exception:
                continue
    return articles
