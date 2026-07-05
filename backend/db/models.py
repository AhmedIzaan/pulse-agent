import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey,
    String, Text, Time, UniqueConstraint, Index,
    func, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    clerk_user_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    profile: Mapped["InterestProfile"] = relationship(back_populates="user", uselist=False)
    digests: Mapped[list["Digest"]] = relationship(back_populates="user")
    articles: Mapped[list["Article"]] = relationship(back_populates="user")


class InterestProfile(Base):
    __tablename__ = "interest_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_interest_profiles_user"),)

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    interests: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_time: Mapped[time] = mapped_column(Time, nullable=False, server_default=text("'08:00'"))
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default=text("'UTC'"))
    email_digest: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="profile")


class Digest(Base):
    __tablename__ = "digests"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_digests_user_date"),
        Index("idx_digests_user_id", "user_id"),
        Index("idx_digests_date", "date"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("'pending'")
    )
    email_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="digests")
    articles: Mapped[list["Article"]] = relationship(back_populates="digest")


class Article(Base):
    __tablename__ = "articles"
    __table_args__ = (
        Index("idx_articles_digest_id", "digest_id"),
        Index("idx_articles_user_id", "user_id"),
        Index("idx_articles_content_hash", "content_hash"),
        Index("idx_articles_fetched_at", "fetched_at"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    digest_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("digests.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Raw (Crawler Agent)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    raw_content: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    content_hash: Mapped[str | None] = mapped_column(String(64))

    # Filter Agent
    relevance_score: Mapped[float | None] = mapped_column(Float)
    pinecone_id: Mapped[str | None] = mapped_column(String(255))
    is_duplicate: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    passed_filter: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    # Synthesis Agent
    summary: Mapped[str | None] = mapped_column(Text)
    why_it_matters: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="articles")
    digest: Mapped["Digest"] = relationship(back_populates="articles")


class ArticleFeedback(Base):
    __tablename__ = "article_feedback"
    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_article_feedback"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    feedback: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ArticleClick(Base):
    __tablename__ = "article_clicks"
    __table_args__ = (
        Index("idx_article_clicks_user_id", "user_id"),
        Index("idx_article_clicks_article_id", "article_id"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    clicked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
