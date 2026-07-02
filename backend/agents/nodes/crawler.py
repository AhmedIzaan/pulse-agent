import asyncio

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from agents.fetchers.arxiv import arxiv_fetch
from agents.fetchers.hn import hn_fetch
from agents.fetchers.reddit import reddit_fetch
from agents.fetchers.rss import rss_fetch
from agents.fetchers.serper import serper_fetch
from agents.state import PipelineState, RawArticle
from core.config import settings


class CrawlPlan(BaseModel):
    rss_feeds: list[str]
    hn_queries: list[str]
    subreddits: list[str]
    arxiv_queries: list[str]
    serper_queries: list[str]


_PLAN_PROMPT = """\
Given the user's interest profile below, generate a targeted crawl plan.

PROFILE:
{interests}

Return:
- rss_feeds: up to 5 relevant RSS feed URLs (well-known, publicly accessible)
- hn_queries: up to 3 Hacker News search terms
- subreddits: up to 5 subreddit names (without r/) relevant to the profile
- arxiv_queries: up to 3 ArXiv keyword queries (only if the profile includes research or academic topics, otherwise empty)
- serper_queries: up to 3 Google News search queries

Be specific — generic queries return noise.

Respond with valid JSON only. No explanation."""


def _keyword_plan(interests: str) -> CrawlPlan:
    """Fallback: extract keywords from profile text without calling an LLM."""
    words = [w.strip(".,;:()").lower() for w in interests.split() if len(w) > 4]
    keywords = list(dict.fromkeys(words))[:6]  # dedupe, take first 6
    q1 = " ".join(keywords[:3])
    q2 = " ".join(keywords[3:6]) or q1
    return CrawlPlan(
        rss_feeds=[
            "https://news.ycombinator.com/rss",
            "https://feeds.feedburner.com/TechCrunch",
            "https://www.wired.com/feed/rss",
        ],
        hn_queries=[q1, q2],
        subreddits=["technology", "MachineLearning", "programming", "artificial", "singularity"],
        arxiv_queries=[q1] if any(t in interests.lower() for t in ["research", "paper", "arxiv", "ml", "ai", "llm"]) else [],
        serper_queries=[q1, q2],
    )


async def _plan_crawl(interests: str) -> CrawlPlan:
    if not settings.deepseek_api_key:
        return _keyword_plan(interests)
    try:
        llm = ChatOpenAI(
            model="deepseek-v4-flash",
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        ).with_structured_output(CrawlPlan, method="json_mode")
        return await llm.ainvoke(_PLAN_PROMPT.format(interests=interests))
    except Exception:
        return _keyword_plan(interests)


async def crawler(state: PipelineState) -> dict:
    profile = state.get("profile")
    if not profile:
        return {"raw_articles": [], "errors": ["Cannot crawl: no profile loaded"]}

    try:
        plan = await _plan_crawl(profile["interests"])
    except Exception as exc:
        return {"raw_articles": [], "errors": [f"Crawl planning failed: {exc}"]}

    results = await asyncio.gather(
        rss_fetch(plan.rss_feeds),
        hn_fetch(plan.hn_queries),
        reddit_fetch(plan.subreddits),
        arxiv_fetch(plan.arxiv_queries),
        serper_fetch(plan.serper_queries, settings.serper_api_key),
        return_exceptions=True,
    )

    all_articles: list[RawArticle] = []
    errors: list[str] = []
    source_names = ["rss", "hn", "reddit", "arxiv", "serper"]
    for name, result in zip(source_names, results):
        if isinstance(result, Exception):
            errors.append(f"{name} fetcher error: {result}")
        else:
            all_articles.extend(result)

    # Deduplicate by URL
    seen: set[str] = set()
    deduped: list[RawArticle] = []
    for article in all_articles:
        url = article["url"]
        if url and url not in seen:
            seen.add(url)
            deduped.append(article)

    return {"raw_articles": deduped, "errors": errors}
