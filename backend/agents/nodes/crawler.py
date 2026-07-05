import asyncio
import logging

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from agents.fetchers.arxiv import arxiv_fetch
from agents.fetchers.hn import hn_fetch
from agents.fetchers.reddit import reddit_fetch
from agents.fetchers.rss import rss_fetch
from agents.fetchers.serper import serper_fetch
from agents.state import PipelineState, RawArticle
from core.config import settings

logger = logging.getLogger(__name__)


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
- rss_feeds: up to 5 RSS feed URLs from well-known publications that SPECIALIZE \
in the profile's domain (music press for a music profile, financial press for a \
finance profile, and so on). Prefer domain publications over general tech feeds.
- hn_queries: up to 3 Hacker News search terms — ONLY if the profile is about \
technology, programming, startups, or science. Hacker News is a technology \
forum: for any other domain return an empty list, because music/finance/culture \
queries there return only tech projects about the topic.
- subreddits: up to 5 subreddit names (without r/) where enthusiasts of this \
exact domain gather.
- arxiv_queries: up to 3 ArXiv queries — ONLY if the profile explicitly \
mentions research papers or academic literature. Otherwise an empty list.
- serper_queries: up to 3 Google News search queries phrased the way the \
domain's own journalism is written.

Match every source to the profile's domain. Do not inject technology or AI \
angles unless the profile asks for them. Be specific — generic queries return noise.

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

    logger.info("[2/6] crawler: planning crawl from interest profile")
    try:
        plan = await _plan_crawl(profile["interests"])
    except Exception as exc:
        logger.warning("crawler: planning failed: %s", exc)
        return {"raw_articles": [], "errors": [f"Crawl planning failed: {exc}"]}

    logger.info(
        "crawler: fetching rss=%d hn=%d reddit=%d arxiv=%d serper=%d",
        len(plan.rss_feeds), len(plan.hn_queries), len(plan.subreddits),
        len(plan.arxiv_queries), len(plan.serper_queries),
    )

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
            logger.warning("crawler: %s fetcher error: %s", name, result)
            errors.append(f"{name} fetcher error: {result}")
        else:
            logger.info("crawler: %s returned %d articles", name, len(result))
            all_articles.extend(result)

    # Deduplicate by URL
    seen: set[str] = set()
    deduped: list[RawArticle] = []
    for article in all_articles:
        url = article["url"]
        if url and url not in seen:
            seen.add(url)
            deduped.append(article)

    logger.info("crawler: %d total → %d after dedup", len(all_articles), len(deduped))

    # Safety cap — only the top ~12 survive filtering anyway, no need to
    # store/embed hundreds of extra articles when a source over-returns.
    capped = deduped[:200]
    if len(deduped) > len(capped):
        logger.info("crawler: capping %d → %d articles", len(deduped), len(capped))

    return {"raw_articles": capped, "errors": errors}
