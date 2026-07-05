from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from db.models import Article, ArticleClick, ArticleFeedback, User
from db.session import get_db

router = APIRouter(prefix="/api")


class FeedbackRequest(BaseModel):
    article_id: str
    feedback: str = Field(..., pattern=r"^(up|down)$")


class ClickRequest(BaseModel):
    article_id: str


async def _get_owned_article(article_id: str, clerk_user_id: str, db: AsyncSession) -> tuple[User, Article]:
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    result = await db.execute(
        select(Article).where(Article.id == article_id, Article.user_id == user.id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(404, "Article not found")
    return user, article


@router.post("/feedback")
async def submit_feedback(
    body: FeedbackRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user, article = await _get_owned_article(body.article_id, clerk_user_id, db)

    result = await db.execute(
        select(ArticleFeedback).where(
            ArticleFeedback.user_id == user.id,
            ArticleFeedback.article_id == article.id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.feedback == body.feedback:
            # Same button pressed again — treat as toggle off
            await db.delete(existing)
            await db.commit()
            return {"ok": True, "feedback": None}
        existing.feedback = body.feedback
    else:
        db.add(ArticleFeedback(
            user_id=user.id,
            article_id=article.id,
            feedback=body.feedback,
        ))

    await db.commit()
    return {"ok": True, "feedback": body.feedback}


@router.post("/clicks")
async def log_click(
    body: ClickRequest,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user, article = await _get_owned_article(body.article_id, clerk_user_id, db)
    db.add(ArticleClick(user_id=user.id, article_id=article.id))
    await db.commit()
    return {"ok": True}
