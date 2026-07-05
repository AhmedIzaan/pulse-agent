from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from db.models import Article, ArticleFeedback, Digest, User
from db.session import get_db

router = APIRouter(prefix="/api")


def _article_out(a: Article, feedback: str | None = None) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "url": a.url,
        "source": a.source,
        "summary": a.summary,
        "why_it_matters": a.why_it_matters,
        "relevance_score": a.relevance_score,
        "published_at": a.published_at.isoformat() if a.published_at else None,
        "feedback": feedback,
    }


async def _feedback_map(user_id: str, article_ids: list[str], db: AsyncSession) -> dict[str, str]:
    if not article_ids:
        return {}
    result = await db.execute(
        select(ArticleFeedback.article_id, ArticleFeedback.feedback).where(
            ArticleFeedback.user_id == user_id,
            ArticleFeedback.article_id.in_(article_ids),
        )
    )
    return dict(result.all())


async def _get_user(clerk_user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.get("/digest/today")
async def get_today_digest(
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(clerk_user_id, db)

    result = await db.execute(
        select(Digest).where(Digest.user_id == user.id, Digest.date == date.today())
    )
    digest = result.scalar_one_or_none()
    if not digest:
        raise HTTPException(404, "No digest for today")

    result = await db.execute(
        select(Article)
        .where(Article.digest_id == digest.id, Article.passed_filter == True)
        .order_by(Article.relevance_score.desc())
    )
    articles = result.scalars().all()
    feedback = await _feedback_map(user.id, [a.id for a in articles], db)

    return {
        "id": digest.id,
        "date": str(digest.date),
        "status": digest.status,
        "article_count": len(articles),
        "articles": [_article_out(a, feedback.get(a.id)) for a in articles],
        "created_at": digest.created_at.isoformat(),
    }


@router.get("/digest/history")
async def get_digest_history(
    q: str = Query("", max_length=200),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(clerk_user_id, db)

    query = select(Digest).where(Digest.user_id == user.id)

    if q.strip():
        # Only digests containing an entry that matches the search term
        pattern = f"%{q.strip()}%"
        matching = (
            select(Article.digest_id)
            .where(
                Article.user_id == user.id,
                Article.passed_filter == True,
                or_(Article.title.ilike(pattern), Article.summary.ilike(pattern)),
            )
        )
        query = query.where(Digest.id.in_(matching))

    result = await db.execute(query.order_by(Digest.date.desc()).limit(30))
    digests = result.scalars().all()

    # One grouped count query instead of a query per digest
    counts: dict[str, int] = {}
    if digests:
        result = await db.execute(
            select(Article.digest_id, func.count())
            .where(
                Article.digest_id.in_([d.id for d in digests]),
                Article.passed_filter == True,
            )
            .group_by(Article.digest_id)
        )
        counts = dict(result.all())

    out = [
        {
            "id": d.id,
            "date": str(d.date),
            "status": d.status,
            "email_sent": d.email_sent,
            "article_count": counts.get(d.id, 0),
            "created_at": d.created_at.isoformat(),
        }
        for d in digests
    ]

    return {"digests": out, "total": len(out)}


@router.get("/digest/{digest_id}")
async def get_digest_by_id(
    digest_id: str,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user(clerk_user_id, db)

    result = await db.execute(
        select(Digest).where(Digest.id == digest_id, Digest.user_id == user.id)
    )
    digest = result.scalar_one_or_none()
    if not digest:
        raise HTTPException(404, "Digest not found")

    result = await db.execute(
        select(Article)
        .where(Article.digest_id == digest.id, Article.passed_filter == True)
        .order_by(Article.relevance_score.desc())
    )
    articles = result.scalars().all()
    feedback = await _feedback_map(user.id, [a.id for a in articles], db)

    return {
        "id": digest.id,
        "date": str(digest.date),
        "status": digest.status,
        "article_count": len(articles),
        "articles": [_article_out(a, feedback.get(a.id)) for a in articles],
        "created_at": digest.created_at.isoformat(),
    }
