import operator
from typing import Annotated, Optional, TypedDict


class ProfileData(TypedDict):
    id: str
    user_id: str
    interests: str
    delivery_time: str
    timezone: str
    email_digest: bool


class RawArticle(TypedDict):
    url: str
    title: str
    raw_content: Optional[str]
    source: str  # hn | reddit | arxiv | rss | serper
    published_at: Optional[str]
    content_hash: Optional[str]
    db_id: Optional[str]
    pinecone_id: Optional[str]


class SynthesizedArticle(TypedDict):
    db_id: str
    url: str
    title: str
    source: str
    published_at: Optional[str]
    summary: str
    why_it_matters: str
    relevance_score: float


class PipelineState(TypedDict):
    user_id: str
    clerk_user_id: str
    profile: Optional[ProfileData]
    raw_articles: list[RawArticle]
    filtered_articles: list[RawArticle]
    synthesized_articles: list[SynthesizedArticle]
    digest_id: Optional[str]
    errors: Annotated[list[str], operator.add]
