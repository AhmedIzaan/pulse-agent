from datetime import datetime, timezone

import httpx

from agents.state import RawArticle

_HEADERS = {"User-Agent": "PulseDigestBot/1.0"}


async def reddit_fetch(subreddits: list[str]) -> list[RawArticle]:
    articles: list[RawArticle] = []
    async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
        for sub in subreddits[:5]:
            try:
                resp = await client.get(
                    f"https://www.reddit.com/r/{sub}/hot.json",
                    params={"limit": 20},
                )
                resp.raise_for_status()
                children = resp.json().get("data", {}).get("children", [])
                for child in children:
                    p = child.get("data", {})
                    url = p.get("url", "")
                    if not url:
                        continue
                    pub_at = None
                    if p.get("created_utc"):
                        pub_at = datetime.fromtimestamp(
                            p["created_utc"], tz=timezone.utc
                        ).isoformat()
                    articles.append(RawArticle(
                        url=url,
                        title=p.get("title", ""),
                        raw_content=p.get("selftext") or None,
                        source="reddit",
                        published_at=pub_at,
                        content_hash=None,
                        db_id=None,
                        pinecone_id=None,
                    ))
            except Exception:
                continue
    return articles
