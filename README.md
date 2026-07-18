# MakeDigest

**A multi-agent AI research digest.** Tell MakeDigest what you follow in plain English — it reads Hacker News, Reddit, ArXiv, RSS feeds, and Google News, filters the noise with a multi-stage relevance pipeline orchestrated by **LangGraph**, and delivers exactly ten entries at the hour *you* choose, in *your* timezone: summarized, scored, and annotated with why each one matters to you.

> Ten entries. On your schedule. Nothing more.

*(Repository codename: `pulse-agent` — the product shipped as MakeDigest at [makedigest.com](https://www.makedigest.com).)*

---

## Table of contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
- [The agent pipeline](#the-agent-pipeline)
- [Scheduling & delivery](#scheduling--delivery)
- [Archive retention](#archive-retention)
- [Personalization loop](#personalization-loop)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Design system](#design-system)

---

## How it works

1. **Profile** — the user describes their interests in plain English (no categories, no checkboxes). Starter templates exist for Tech, Gaming, Music, Finance, and Literature.
2. **Schedule** — the user picks a delivery hour (all 24 slots, shown in AM/PM), the days of the week, and whether to receive the brief by email as well as on the dashboard. Timezone is detected from the browser automatically. Saving offers two paths: **Deploy now** (compile a brief immediately) or **Save for scheduled run** (hold changes until the next scheduled time).
3. **Crawl** — an LLM plans a source-appropriate crawl (music press for music profiles, HN only for tech profiles), then five fetchers run concurrently.
4. **Filter** — three stages: content-hash dedup → Pinecone semantic similarity boost → LLM relevance scoring against the profile *and* the user's past feedback.
5. **Synthesize** — each surviving article gets a 3-sentence summary plus a one-line "why this matters to you" margin note.
6. **Deliver** — a digest record is assembled, articles are linked, and (if opted in) an HTML email is sent via Resend. The dashboard shows the same ten entries.
7. **Learn** — every click and ▲/▼ rating feeds back into the next run's scoring.
8. **Retain lightly** — the archive keeps only the previous day's digest; older digests, their articles, and their Pinecone vectors are purged automatically.

## Architecture

The system is a Next.js frontend, a FastAPI backend whose core is a **LangGraph agent pipeline**, and an hourly Railway Cron heartbeat that drives per-user scheduling and retention.

```mermaid
flowchart TB
    subgraph FE["Frontend — Next.js 14 App Router, hosted on Vercel"]
        direction LR
        PAGES["/ landing · /onboarding profile-and-schedule editor · /dashboard today's brief · /history archive"]
    end

    CRON["Railway Cron service<br/>fires every hour — 0 * * * *<br/>POST /api/pipeline/cron with X-Cron-Secret"]

    subgraph BE["Backend — FastAPI + Python 3.12, hosted on Railway"]
        AUTH["Clerk JWT verification<br/>JWKS · RS256 · no server sessions"]
        API["REST API<br/>profile · pipeline · digest · feedback · clicks"]
        GATE["Scheduler gate<br/>for each user: paused? delivery day?<br/>local hour == chosen hour? already delivered today?"]
        RETAIN["Archive retention<br/>purges digests older than 1 day<br/>plus their articles and vectors"]

        subgraph LG["LangGraph pipeline — linear StateGraph, six agent nodes, runs as a background task"]
            direction LR
            N1["load_profile"] --> N2["crawler"] --> N3["store_raw"] --> N4["filter"] --> N5["synthesis"] --> N6["delivery"]
        end
    end

    subgraph EXT["External services"]
        direction LR
        PG[("PostgreSQL<br/>Railway")]
        PC[("Pinecone serverless<br/>vectors + e5-large inference")]
        DS["DeepSeek V4<br/>Flash / Pro"]
        SRC["HN · Reddit · ArXiv<br/>RSS · Serper News"]
        RS["Resend<br/>email"]
    end

    FE -- "Bearer JWT on every call" --> AUTH --> API
    API -- "Deploy now / status" --> LG
    CRON --> GATE
    GATE -- "one run per matching user" --> LG
    GATE --> RETAIN
    LG --- PG
    LG --- PC
    LG --- DS
    LG --- SRC
    LG --- RS
    RETAIN --- PG
    RETAIN --- PC
```

**Auth flow:** Clerk issues an RS256 JWT in the browser → every API call carries it as a Bearer token → FastAPI verifies the signature against Clerk's JWKS endpoint (cached, 1-hour lifespan) and extracts the `clerk_user_id`. No sessions or cookies on the backend.

**Two ways a pipeline starts:** a user clicks **Deploy now** (authenticated `POST /api/pipeline/run`), or the hourly cron tick finds users whose schedule matches the current moment. Both paths converge on the same LangGraph graph; a per-user in-flight guard makes duplicate triggers a no-op.

## The agent pipeline

The core of the backend is a [LangGraph](https://github.com/langchain-ai/langgraph) `StateGraph` defined in [`backend/agents/graph.py`](backend/agents/graph.py) — six agent nodes wired linearly, sharing a typed state dict ([`state.py`](backend/agents/state.py)) that accumulates as it flows through the graph:

```mermaid
flowchart TB
    S(["START"]) --> LP

    LP["1 · load_profile<br/>Resolves Clerk user → DB user → interest profile.<br/>Aborts cleanly if no profile exists."]

    CR["2 · crawler — DeepSeek V4 Flash<br/>LLM writes a CrawlPlan matched to the profile's domain:<br/>RSS feeds, HN / ArXiv / News queries, subreddits.<br/>Five fetchers run concurrently, deduped by URL, capped at 200."]

    SR["3 · store_raw<br/>Batch-inserts new articles into Postgres, skips anything<br/>delivered in a past digest (URL + content hash), embeds new<br/>articles via Pinecone inference and upserts the vectors.<br/>Prunes vectors older than one day (free-tier cap)."]

    FI["4 · filter — DeepSeek V4 Flash<br/>Stage 1: content-hash dedup.<br/>Stage 2: Pinecone cosine similarity vs the profile embedding.<br/>Stage 3: LLM scoring with the user's taste signals injected.<br/>Keeps the top 10 scoring ≥ 5, max 4 per source."]

    SY["5 · synthesis — DeepSeek V4 Pro<br/>Per article, in parallel: a 3-sentence summary and a one-line<br/>'why it matters to you', written against the profile."]

    DE["6 · delivery<br/>Upserts the day's digest row (unique per user + date),<br/>atomically replaces its article set, renders the inline-CSS<br/>HTML email and sends via Resend if the user opted in."]

    LP --> CR --> SR --> FI --> SY --> DE --> E(["END"])
```

**Notes on LLM usage:** DeepSeek is called through its OpenAI-compatible API. Structured output uses `response_format={"type": "json_object"}` (or LangChain's `method="json_mode"`) — DeepSeek's thinking mode does not support tool-choice-based structured output.

**Concurrency guard:** a per-user in-flight set prevents duplicate pipeline runs (double LLM spend, digest races). `GET /api/pipeline/status` exposes it so the frontend can show real progress.

## Scheduling & delivery

Every user gets their brief at the hour they chose, in their own timezone:

- **Hourly heartbeat.** A dedicated Railway Cron service fires `POST /api/pipeline/cron` once an hour (`0 * * * *`), authenticated by a timing-safe `X-Cron-Secret` compare.
- **Per-user matching.** On each tick the scheduler walks all profiles and runs the pipeline only for users who are not paused, whose delivery days include today, and whose **local hour** (via `zoneinfo`, per-profile IANA timezone) equals their chosen delivery hour.
- **Exactly-once per day.** A user already holding today's delivered digest is skipped; a digest stuck in `processing` for over 15 minutes is presumed crashed and retried.
- **Stand-down.** Pausing suspends scheduled runs entirely until resumed; the profile stays editable.
- **tzdata note:** the `tzdata` wheel is pinned in `requirements.txt` — server images often lack OS timezone data, and without it per-user scheduling silently degrades to UTC (a loud error is logged if that ever happens).

## Archive retention

The archive is deliberately tiny — this keeps the Pinecone free tier and the database well within limits:

- The history page holds **at most the previous day's digest** alongside today's. On every hourly tick, [`scheduler/cleanup.py`](backend/scheduler/cleanup.py) deletes digests older than yesterday (UTC), their articles, and any Pinecone vectors those articles still hold.
- Vectors are deleted **before** the database rows that record their IDs; if Pinecone is unreachable the purge aborts and retries next hour, so vectors are never orphaned.
- Articles the user reacted to (👍/👎 or click) survive as **slim rows** — title only, heavy content stripped — because the filter's taste signals are built from those titles. Personalization keeps learning even though the archive doesn't grow.
- Independently, `store_raw` prunes each user's vectors older than one day during every run — retention is enforced from both sides.

## Personalization loop

Three signals are captured and fed into the filter's scoring prompt on every run:

- **▲ more like this / ▼ less** — upserted per user+article (pressing the same button again toggles it off)
- **Clicks** — logged fire-and-forget when a user opens an article
- The filter fetches the 10 most recent liked, disliked, and clicked titles and instructs the scorer to weigh candidates accordingly

Deduplication keeps briefs fresh: an article delivered in a previous digest is excluded from new runs (URL and content-hash matched at store time). With one-day retention the dedup window is one day — same-day re-runs are exempt, so regenerating after a profile edit keeps the best picks.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS | Server components fetch with the Clerk server token |
| Auth | Clerk | RS256 JWT, verified backend-side via PyJWKClient |
| Backend | FastAPI, Python 3.12, uvicorn | Async throughout |
| Orchestration | **LangGraph 0.2** | Linear six-node `StateGraph`, typed state dict |
| LLMs | DeepSeek V4 Flash (planning, scoring) · DeepSeek V4 Pro (synthesis) | OpenAI-compatible API |
| Embeddings | Pinecone inference — `multilingual-e5-large` (1024-dim) | No separate embedding provider needed |
| Vector DB | Pinecone serverless (AWS us-east-1), cosine | Vectors pruned after 1 day, from both the pipeline and the retention sweep |
| Database | PostgreSQL (Railway), SQLAlchemy 2.0 async + asyncpg, Alembic | `postgresql://` URLs auto-normalized to `postgresql+asyncpg://` |
| Scheduling | Railway Cron (hourly) + per-user timezone matching (`zoneinfo` + pinned `tzdata`) | Delivery hour, weekday set, pause — all per profile |
| Sources | HN Algolia API · Reddit JSON API · ArXiv API · RSS (httpx + feedparser) · Serper Google News | Reddit currently blocked (403) pending OAuth credentials |
| Email | Resend | Notebook-styled inline-CSS HTML template, per-user opt-in |
| Deploy | Vercel (frontend) · Railway (backend + Postgres + cron) | Python pinned via `.python-version` |

## Data model

Six tables (see [`backend/db/models.py`](backend/db/models.py) and [`docs/db-schema.md`](docs/db-schema.md)):

```
users ──┬── interest_profiles   (1:1 — interests text, delivery_time, timezone,
        │                        delivery_days, email_digest, paused)
        ├── digests             (1:N — unique per user+date, status, email_sent)
        ├── articles            (1:N — raw content, scores, summary, digest_id FK)
        ├── article_feedback    (unique per user+article — "up" | "down")
        └── article_clicks      (append-only click log)
```

An article belongs to at most one digest. Delivery replaces a digest's article set atomically, and previously-delivered articles are excluded from future runs. The retention sweep keeps only the previous day's digest — older rows are purged hourly, with reacted-to articles kept as slim title-only rows for taste signals.

## API reference

All routes except `/health` require `Authorization: Bearer <clerk-jwt>`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/me` | Verify token, return Clerk user id |
| GET / POST | `/api/profile` | Fetch / upsert interest profile (interests, delivery time/days, timezone, email opt-in, pause) |
| POST | `/api/pipeline/run` | Queue a pipeline run — "Deploy now" (no-op if already running) |
| GET | `/api/pipeline/status` | `{running: bool}` for the current user |
| POST | `/api/pipeline/cron` | Hourly tick: run matching users' pipelines + retention sweep — guarded by `X-Cron-Secret` header (timing-safe compare) |
| GET | `/api/digest/today` | Today's digest with articles + user feedback |
| GET | `/api/digest/history?q=` | The archive (today + previous day under retention); `q` searches entry titles/summaries |
| GET | `/api/digest/{id}` | One past digest (ownership-checked) |
| POST | `/api/feedback` | `{article_id, feedback: "up"|"down"}` — toggle semantics |
| POST | `/api/clicks` | `{article_id}` — log a click |

## Project structure

```
pulse-agent/
├── frontend/                  # Next.js 14 (Vercel)
│   ├── app/
│   │   ├── page.tsx           # Landing (redirects signed-in users)
│   │   ├── onboarding/        # Profile + schedule editor, deploy-now / save split
│   │   ├── dashboard/         # Today's digest, compiling view, run button
│   │   ├── history/           # Archive (1-day retention) + [id] detail pages
│   │   └── sign-in|sign-up/   # Clerk
│   ├── components/            # SiteNav, ArticleEntry, PageLoading
│   └── middleware.ts          # Clerk route protection
├── backend/                   # FastAPI (Railway)
│   ├── main.py                # App entry, CORS, routers, logging
│   ├── api/                   # health, users, profile, pipeline (incl. cron gate), digest, feedback
│   ├── agents/
│   │   ├── graph.py           # LangGraph StateGraph wiring
│   │   ├── state.py           # PipelineState TypedDicts
│   │   ├── nodes/             # load_profile, crawler, store_raw, filter, synthesis, delivery
│   │   └── fetchers/          # rss, hn, reddit, arxiv, serper
│   ├── scheduler/             # cleanup.py — hourly archive retention sweep
│   ├── core/                  # config (pydantic-settings), auth (Clerk JWT)
│   ├── db/                    # models, async session, Alembic migrations
│   └── alembic/
└── docs/                      # architecture, agent-design, api-spec, db-schema, progress
```

## Local development

**Prerequisites:** Node 18+, Python 3.12, a Postgres database, and accounts/keys for Clerk, DeepSeek, Pinecone, Serper, and Resend.

### Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# create .env with the vars below
alembic upgrade head
uvicorn main:app --reload           # http://localhost:8000
```

`backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/pulse
CLERK_JWKS_URL=https://<your-clerk-domain>/.well-known/jwks.json
ALLOWED_ORIGINS=http://localhost:3000
DEEPSEEK_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=pulse-articles
SERPER_API_KEY=...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev   # until you verify a domain
CRON_SECRET=<long random string>
```

Create the Pinecone index once: serverless, AWS `us-east-1`, dimension **1024**, metric **cosine**, name `pulse-articles`.

### Frontend

```bash
cd frontend
npm install
npm run dev                          # http://localhost:3000
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Trying it end-to-end

Sign up → describe your interests (or click a starter template) → pick a delivery hour and days → **Deploy now**. You land on the compiling view; the pipeline takes 60–90 seconds and the entries appear on their own. Watch the backend logs — every node reports progress (`[1/6] load_profile … [6/6] delivery`). Use **Save for scheduled run** instead to hold changes for the next scheduled delivery.

## Deployment

- **Frontend → Vercel.** Set the three frontend env vars; point `NEXT_PUBLIC_API_URL` at the Railway backend URL.
- **Backend → Railway.** Python version pinned by `backend/.python-version` (3.12). Set all backend env vars; Railway's `postgresql://` DATABASE_URL is auto-normalized for asyncpg. Add the frontend's production URL to `ALLOWED_ORIGINS`.
- **Scheduling → Railway Cron.** Add a cron service (e.g. the `curlimages/curl` image) with schedule **`0 * * * *`** — it must fire **hourly**, because the backend matches each user's chosen hour in their own timezone on every tick:

  ```bash
  curl -X POST https://<backend>.railway.app/api/pipeline/cron -H "X-Cron-Secret: $CRON_SECRET"
  ```

  Each tick runs the pipeline only for users whose schedule matches that moment, then performs the archive-retention sweep. A tick with no matching users costs nothing but the sweep.

## Design system

The UI is a **notebook / field-log**: Vellum `#EDE6D6` paper, Ink `#2B2A25` text, Walnut `#8B6F47` annotations, Moss `#3D5A4C` and Wax `#B23A2E` accents, Pencil `#A8A092` metadata. Fraunces for display type, Inter for body, IBM Plex Mono for metadata. **No gradients, no shadows, no border-radius** — even the loading spinner is a square. Signature elements: double-rule mastheads, stamped tags, italic walnut margin notes ("— why this matters to you"), and thin entry rules between digest items. The email template mirrors the same system with inline CSS.

---

*Built module-by-module as an 8-week project — progress log in [`docs/progress.md`](docs/progress.md).*
