import asyncio
import json
import logging
import re

from openai import AsyncOpenAI
from sqlalchemy import select

from agents.state import PipelineState, SynthesizedArticle
from core.config import settings
from db.models import Article
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

_SYSTEM = """\
You are a synthesis assistant for a personalized AI news digest.
For the article provided, write:
1. A 3-sentence summary of the article
2. One sentence explaining why this matters specifically to the user

Return JSON only: {"summary": "...", "why_it_matters": "..."}
Keep both under 150 words total. Be direct and specific. No filler phrases.\
"""


async def _synthesize_one(
    client: AsyncOpenAI,
    profile_interests: str,
    article: dict,
) -> tuple[str, str]:
    content = (article.get("raw_content") or "")[:3000]
    user_msg = (
        f"USER PROFILE:\n{profile_interests}\n\n"
        f"ARTICLE:\nTitle: {article['title']}\nContent: {content}"
    )
    resp = await client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    raw = resp.choices[0].message.content or ""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(match.group()) if match else {}

    return data.get("summary", ""), data.get("why_it_matters", "")


async def synthesize(state: PipelineState) -> dict:
    filtered = state.get("filtered_articles", [])
    profile = state.get("profile")

    if not filtered or not profile:
        return {"synthesized_articles": [], "errors": []}

    logger.info("[5/6] synthesis: writing summaries for %d articles", len(filtered))

    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )

    tasks = [
        _synthesize_one(client, profile["interests"], article)
        for article in filtered
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    synthesized: list[SynthesizedArticle] = []
    errors: list[str] = []
    db_updates: list[tuple[str, str, str, float]] = []  # (id, summary, why, score)

    for article, result in zip(filtered, results):
        if isinstance(result, Exception):
            errors.append(f"Synthesis failed for '{article['title'][:50]}': {result}")
            continue

        summary, why = result
        if not summary:
            continue

        score = float(article.get("relevance_score", 0.0))
        synthesized.append(SynthesizedArticle(
            db_id=article.get("db_id", ""),
            url=article["url"],
            title=article["title"],
            source=article["source"],
            published_at=article.get("published_at"),
            summary=summary,
            why_it_matters=why,
            relevance_score=score,
        ))
        if article.get("db_id"):
            db_updates.append((article["db_id"], summary, why, score))

    # Batch update DB
    if db_updates:
        async with AsyncSessionLocal() as db:
            for db_id, summary, why, score in db_updates:
                result = await db.execute(select(Article).where(Article.id == db_id))
                db_article = result.scalar_one_or_none()
                if db_article:
                    db_article.summary = summary
                    db_article.why_it_matters = why
                    db_article.relevance_score = score
                    db_article.passed_filter = True
            await db.commit()

    logger.info("synthesis: done — %d synthesized, %d errors", len(synthesized), len(errors))
    return {"synthesized_articles": synthesized, "errors": errors}
