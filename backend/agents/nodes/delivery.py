import html
import logging
from datetime import date

import resend
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from agents.state import PipelineState, SynthesizedArticle
from core.config import settings
from db.models import Article, Digest, User
from db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


def _build_email_html(articles: list[SynthesizedArticle], digest_date: str) -> str:
    entries_html = ""
    for i, a in enumerate(articles):
        # Article fields come from external feeds — escape everything
        source = html.escape(a["source"])
        title = html.escape(a["title"])
        url = html.escape(a["url"], quote=True)
        summary = html.escape(a["summary"])
        why = html.escape(a["why_it_matters"])
        border_top = "border-top: 1px solid #d4cfc6; margin-top: 28px; padding-top: 28px;" if i > 0 else ""
        entries_html += f"""
        <div style="{border_top}">
          <div style="font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 0.1em;
                      text-transform: uppercase; color: #8B6F47; margin-bottom: 10px;">
            {source}
          </div>
          <h2 style="font-size: 18px; font-weight: 700; color: #2B2A25; margin: 0 0 12px 0;
                     line-height: 1.35; letter-spacing: -0.01em;">
            <a href="{url}" style="color: #2B2A25; text-decoration: none;">{title}</a>
          </h2>
          <p style="font-size: 14px; color: #2B2A25; line-height: 1.7; margin: 0 0 12px 0;">
            {summary}
          </p>
          <p style="font-size: 13px; color: #8B6F47; font-style: italic; line-height: 1.6; margin: 0;">
            — {why}
          </p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pulse — {digest_date}</title></head>
<body style="margin: 0; padding: 0; background-color: #EDE6D6; font-family: Inter, system-ui, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 24px;">

    <div style="margin-bottom: 8px;">
      <span style="font-family: Georgia, serif; font-size: 28px; font-weight: 900;
                   letter-spacing: -0.02em; color: #2B2A25;">PULSE</span>
    </div>
    <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #A8A092;
                margin-bottom: 4px;">{digest_date}</div>
    <div style="border-top: 1px solid #A8A092; margin: 12px 0 4px 0;"></div>
    <div style="border-top: 1px solid #A8A092; margin-bottom: 32px;"></div>

    <p style="font-size: 13px; color: #A8A092; margin: 0 0 32px 0;
              font-family: 'Courier New', monospace;">
      {len(articles)} entries · your daily field log
    </p>

    {entries_html}

    <div style="border-top: 1px solid #A8A092; margin-top: 40px; padding-top: 24px;">
      <p style="font-family: 'Courier New', monospace; font-size: 11px; color: #A8A092; margin: 0;">
        Ten entries. Every morning. Nothing more.
      </p>
    </div>
  </div>
</body>
</html>"""


async def deliver(state: PipelineState) -> dict:
    synthesized = state.get("synthesized_articles", [])
    user_id = state.get("user_id", "")
    errors: list[str] = []

    logger.info("[6/6] delivery: assembling digest from %d articles", len(synthesized))

    if not synthesized:
        logger.warning("delivery: no synthesized articles to deliver")
        return {"digest_id": None, "errors": ["No synthesized articles to deliver"]}

    today = date.today()
    digest_id: str | None = None
    user_email: str | None = None

    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user:
            user_email = user.email

        # Upsert digest record
        result = await db.execute(
            select(Digest).where(Digest.user_id == user_id, Digest.date == today)
        )
        digest = result.scalar_one_or_none()
        if digest is None:
            digest = Digest(user_id=user_id, date=today, status="processing")
            db.add(digest)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                result = await db.execute(
                    select(Digest).where(Digest.user_id == user_id, Digest.date == today)
                )
                digest = result.scalar_one()
        else:
            digest.status = "processing"

        digest_id = digest.id

        # Replace the digest's article set: unlink whatever a previous run
        # attached today, then link the current selection. Without the unlink,
        # re-running the pipeline accumulates entries beyond the promised ten.
        await db.execute(
            update(Article).where(Article.digest_id == digest_id).values(digest_id=None)
        )
        new_ids = [a["db_id"] for a in synthesized if a.get("db_id")]
        if new_ids:
            await db.execute(
                update(Article).where(Article.id.in_(new_ids)).values(digest_id=digest_id)
            )

        await db.commit()

    # Send email via Resend — only if the user opted in on their profile
    profile = state.get("profile")
    wants_email = bool(profile and profile.get("email_digest"))
    email_sent = False
    if wants_email and settings.resend_api_key and user_email:
        try:
            digest_date = today.strftime("%B %d, %Y")
            html = _build_email_html(synthesized, digest_date)
            resend.api_key = settings.resend_api_key
            resend.Emails.send({
                "from": settings.resend_from_email,
                "to": [user_email],
                "subject": f"Your Pulse digest — {today.strftime('%B %d')}",
                "html": html,
            })
            email_sent = True
            logger.info("delivery: digest email sent to user %s", user_id)
        except Exception as exc:
            errors.append(f"Email send failed (digest still saved): {exc}")
    elif wants_email and not user_email:
        logger.warning("delivery: user %s opted into email but has no address on file", user_id)

    # Mark digest as delivered
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Digest).where(Digest.id == digest_id))
        digest = result.scalar_one_or_none()
        if digest:
            digest.status = "delivered"
            digest.email_sent = email_sent
            await db.commit()

    logger.info("Digest %s delivered — %d articles, email_sent=%s", digest_id, len(synthesized), email_sent)
    return {"digest_id": digest_id, "errors": errors}
