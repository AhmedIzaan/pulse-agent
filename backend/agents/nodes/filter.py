import asyncio
import json
import logging
import re

from openai import AsyncOpenAI
from pinecone import Pinecone

from agents.state import PipelineState, RawArticle
from core.config import settings

logger = logging.getLogger(__name__)

_SYSTEM = """\
You are a relevance scoring assistant for a personalized news digest.
Score each article 0–10 based on relevance to the user profile provided.
Return a JSON object: {"scores": [{"index": 0, "score": 7.5}, ...]}
Higher scores mean more relevant. Be strict — most articles should score below 5.\
"""


def _embed_query(text: str) -> list[float]:
    pc = Pinecone(api_key=settings.pinecone_api_key)
    result = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=[text],
        parameters={"input_type": "query"},
    )
    return result[0].values


async def _pinecone_scores(profile_interests: str, articles: list[RawArticle], user_id: str) -> dict[str, float]:
    """Returns db_id → similarity score for articles that pass the 0.65 threshold."""
    loop = asyncio.get_event_loop()
    try:
        embedding = await loop.run_in_executor(None, _embed_query, profile_interests)
    except Exception as exc:
        logger.warning("filter: profile embedding failed, skipping Pinecone boost: %s", exc)
        return {}

    pc = Pinecone(api_key=settings.pinecone_api_key)
    index = pc.Index(settings.pinecone_index_name)

    pinecone_ids = [
        f"{user_id}_{a['db_id']}"
        for a in articles
        if a.get("db_id") and a.get("pinecone_id")
    ]
    if not pinecone_ids:
        return {}

    try:
        result = await loop.run_in_executor(
            None,
            lambda: index.query(
                vector=embedding,
                top_k=min(len(pinecone_ids), 100),
                filter={"user_id": {"$eq": user_id}},
                include_metadata=True,
            ),
        )
        scores: dict[str, float] = {}
        for match in result.matches:
            if match.score >= 0.65:
                article_id = match.metadata.get("article_id", "")
                if article_id:
                    scores[article_id] = match.score
        return scores
    except Exception as exc:
        logger.warning("filter: Pinecone query failed, skipping boost: %s", exc)
        return {}


async def _llm_score_batch(
    client: AsyncOpenAI,
    profile_interests: str,
    batch: list[RawArticle],
    offset: int,
) -> list[dict]:
    articles_text = "\n".join(
        f"{offset + i}. {a['title']}\n   {(a.get('raw_content') or '')[:300]}"
        for i, a in enumerate(batch)
    )
    user_msg = f"USER PROFILE:\n{profile_interests}\n\nARTICLES TO SCORE:\n{articles_text}"

    resp = await client.chat.completions.create(
        model="deepseek-v4-flash",
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    content = resp.choices[0].message.content or ""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\[.*?\]", content, re.DOTALL)
        data = {"scores": json.loads(match.group())} if match else {"scores": []}

    raw = data.get("scores") or data.get("results") or []
    if not isinstance(raw, list):
        for v in data.values():
            if isinstance(v, list):
                raw = v
                break
    return raw


async def filter_articles(state: PipelineState) -> dict:
    raw_articles = state.get("raw_articles", [])
    profile = state.get("profile")
    user_id = state.get("user_id", "")
    errors: list[str] = []

    if not raw_articles or not profile:
        return {"filtered_articles": raw_articles, "errors": []}

    logger.info("[4/6] filter: scoring %d raw articles", len(raw_articles))

    # Stage 1 — deduplicate by content_hash
    seen: set[str] = set()
    deduped: list[RawArticle] = []
    for a in raw_articles:
        key = a.get("content_hash") or a["url"]
        if key not in seen:
            seen.add(key)
            deduped.append(a)

    logger.info("filter: %d after content-hash dedup", len(deduped))

    # Stage 2 — Pinecone semantic pre-filter (boost scores, non-blocking)
    pinecone_scores = await _pinecone_scores(profile["interests"], deduped, user_id)
    logger.info("filter: %d articles boosted by Pinecone similarity", len(pinecone_scores))

    # Stage 3 — LLM relevance scoring in batches of 10
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )
    llm_scores: dict[int, float] = {}

    tasks = []
    offsets = []
    for i in range(0, len(deduped), 10):
        tasks.append(_llm_score_batch(client, profile["interests"], deduped[i:i + 10], i))
        offsets.append(i)

    logger.info("filter: sending %d batches to DeepSeek for scoring", len(tasks))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for offset, result in zip(offsets, results):
        if isinstance(result, Exception):
            errors.append(f"LLM scoring batch at offset {offset} failed: {result}")
            for j in range(offset, min(offset + 10, len(deduped))):
                llm_scores[j] = 5.0
        else:
            for item in result:
                idx = item.get("index", -1)
                score = float(item.get("score", 0))
                if 0 <= idx < len(deduped):
                    llm_scores[idx] = score

    # Combine scores: LLM score + Pinecone boost
    combined: dict[int, float] = {}
    for idx, article in enumerate(deduped):
        llm = llm_scores.get(idx, 0.0)
        pinecone_boost = pinecone_scores.get(article.get("db_id", ""), 0.0) * 2
        combined[idx] = llm + pinecone_boost

    # Keep top 10 with LLM score >= 5 — the product promise is ten entries
    ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    filtered = []
    for idx, score in ranked[:10]:
        if llm_scores.get(idx, 0) >= 5.0:
            filtered.append({**deduped[idx], "relevance_score": combined[idx]})

    filtered.sort(key=lambda a: a.get("relevance_score", 0), reverse=True)
    logger.info("filter: kept %d articles above threshold", len(filtered))
    return {"filtered_articles": filtered, "errors": errors}
