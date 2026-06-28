import httpx

from agents.state import RawArticle


async def hn_fetch(queries: list[str]) -> list[RawArticle]:
    articles: list[RawArticle] = []
    async with httpx.AsyncClient(timeout=10) as client:
        for query in queries[:3]:
            try:
                resp = await client.get(
                    "https://hn.algolia.com/api/v1/search_by_date",
                    params={"query": query, "tags": "story", "hitsPerPage": 10},
                )
                resp.raise_for_status()
                for hit in resp.json().get("hits", []):
                    url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    articles.append(RawArticle(
                        url=url,
                        title=hit.get("title", ""),
                        raw_content=hit.get("story_text"),
                        source="hn",
                        published_at=hit.get("created_at"),
                        content_hash=None,
                        db_id=None,
                        pinecone_id=None,
                    ))
            except Exception:
                continue
    return articles
