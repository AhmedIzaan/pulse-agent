from agents.state import PipelineState


async def filter_articles(state: PipelineState) -> dict:
    # Week 4: semantic similarity (Pinecone) + LLM scoring (DeepSeek V4 Flash)
    return {"filtered_articles": state.get("raw_articles", [])}
