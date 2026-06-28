import logging

from fastapi import APIRouter, BackgroundTasks, Depends

from core.auth import get_current_user

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


async def _run_pipeline(clerk_user_id: str) -> None:
    from agents.graph import build_graph

    graph = build_graph()
    result = await graph.ainvoke({
        "user_id": "",
        "clerk_user_id": clerk_user_id,
        "profile": None,
        "raw_articles": [],
        "filtered_articles": [],
        "synthesized_articles": [],
        "digest_id": None,
        "errors": [],
    })
    if result.get("errors"):
        logger.warning("Pipeline errors for %s: %s", clerk_user_id, result["errors"])
    logger.info(
        "Pipeline complete for %s — %d articles stored",
        clerk_user_id,
        len(result.get("raw_articles", [])),
    )


@router.post("/pipeline/run", status_code=202)
async def trigger_pipeline(
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(get_current_user),
):
    background_tasks.add_task(_run_pipeline, clerk_user_id)
    return {"status": "queued"}
