# Pulse

**A multi-agent AI research digest.** Tell Pulse what you follow in plain English — it reads Hacker News, Reddit, ArXiv, RSS feeds, and Google News overnight, filters the noise with a two-stage relevance pipeline, and delivers exactly ten entries each morning: summarized, scored, and annotated with why each one matters *to you*.

> Ten entries. Every morning. Nothing more.

---

## Table of contents

- [How it works](#how-it-works)
- [Architecture](#architecture)
- [The agent pipeline](#the-agent-pipeline)
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
2. **Crawl** — an LLM plans a source-appropriate crawl (music press for music profiles, HN only for tech profiles), then five fetchers run concurrently.
3. **Filter** — three stages: content-hash dedup → Pinecone semantic similarity boost → LLM relevance scoring against the profile *and* the user's past feedback.
4. **Synthesize** — each surviving article gets a 3-sentence summary plus a one-line "why this matters to you" margin note.
5. **Deliver** — a digest record is assembled, articles are linked, and an HTML email is sent via Resend. The dashboard shows the same ten entries.
6. **Learn** — every click and ▲/▼ rating feeds back into the next run's scoring.

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────────────┐
│  Frontend (Vercel)      │        │  Backend (Railway)                   │
│  Next.js 14 App Router  │  JWT   │  FastAPI + Python 3.12               │
│  Tailwind + Clerk       ├───────▶│  Clerk JWT verification (JWKS/RS256) │
│                         │        │                                      │
│  /            landing   │        │  ┌────────────────────────────────┐  │
│  /onboarding  profile   │        │  │  LangGraph pipeline (6 nodes)  │  │
│  /dashboard   today     │        │  │  runs as a background task     │  │
│  /history     archive   │        │  └───────────┬────────────────────┘  │
└─────────────────────────┘        └──────────────┼───────────────────────┘
                                                  │
                    ┌─────────────┬───────────────┼──────────────┬──────────────┐
                    ▼             ▼               ▼              ▼              ▼
              ┌──────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────┐ ┌───────────┐
              │ Postgres │ │  Pinecone  │ │  DeepSeek   │ │  Serper  │ │  Resend   │
              │ (Railway)│ │ serverless │ │  V4 Flash / │ │ (Google  │ │  (email)  │
              │          │ │ + inference│ │  V4 Pro     │ │  News)   │ │           │
              └──────────┘ └────────────┘ └─────────────┘ └──────────┘ └───────────┘
```

**Auth flow:** Clerk issues an RS256 JWT in the browser → every API call carries it as a Bearer token → FastAPI verifies the signature against Clerk's JWKS endpoint (cached, 1-hour lifespan) and extracts the `clerk_user_id`. No sessions or cookies on the backend.

## The agent pipeline

A linear [LangGraph](https://github.com/langchain-ai/langgraph) state machine defined in [`backend/agents/graph.py`](backend/agents/graph.py). State is a typed dict ([`state.py`](backend/agents/state.py)) that accumulates as it flows through six nodes:

```
START → load_profile → crawler → store_raw → filter → synthesis → delivery → END
```

| # | Node | What it does | LLM used |
|---|------|-------------|----------|
| 1 | **load_profile** | Resolves Clerk user → DB user → interest profile | — |
| 2 | **crawler** | Generates a `CrawlPlan` (RSS feeds, HN/ArXiv/News queries, subreddits) matched to the profile's *domain* — HN only for tech profiles, ArXiv only for research profiles. Falls back to a keyword plan if the LLM call fails. Runs all five fetchers concurrently with `asyncio.gather`, dedupes by URL, caps at 200 articles | DeepSeek V4 Flash |
| 3 | **store_raw** | Batch-inserts new articles into Postgres, drops non-http(s) URLs, excludes anything already delivered in a previous digest (by URL *and* content hash), embeds new articles via Pinecone inference (`multilingual-e5-large`, chunked ≤96), upserts vectors, and prunes vectors older than one day (free-tier housekeeping) | — |
| 4 | **filter** | Stage 1: content-hash dedup. Stage 2: Pinecone cosine-similarity boost vs. profile embedding (≥0.65 threshold). Stage 3: LLM scoring in parallel batches of 10, with the user's taste signals (likes / dislikes / clicks) injected into the prompt. Keeps the top 10 with LLM score ≥ 5, max 4 per source | DeepSeek V4 Flash |
| 5 | **synthesis** | Per-article, in parallel: 3-sentence summary + one-line "why it matters for you", written against the profile. Results persisted to the article rows | DeepSeek V4 Pro |
| 6 | **delivery** | Upserts the day's digest row (unique per user+date), atomically replaces its article set (re-runs can't accumulate or steal from past digests), renders the HTML email (all fields escaped), sends via Resend, marks the digest delivered | — |

**Notes on LLM usage:** DeepSeek is called through its OpenAI-compatible API. Structured output uses `response_format={"type": "json_object"}` (or LangChain's `method="json_mode"`) — DeepSeek's thinking mode does not support tool-choice-based structured output.

**Concurrency guard:** a per-user in-flight set prevents duplicate pipeline runs (double LLM spend, digest races). `GET /api/pipeline/status` exposes it so the frontend can show real progress.

## Personalization loop

Three signals are captured and fed into the filter's scoring prompt on every run:

- **▲ more like this / ▼ less** — upserted per user+article (pressing the same button again toggles it off)
- **Clicks** — logged fire-and-forget when a user opens an article
- The filter fetches the 10 most recent liked, disliked, and clicked titles and instructs the scorer to weigh candidates accordingly

Deduplication guarantees freshness: an article delivered in any previous digest can never appear again (URL and content-hash matched at store time). Same-day re-runs are exempt, so regenerating after a profile edit keeps the best picks.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS | Server components fetch with the Clerk server token |
| Auth | Clerk | RS256 JWT, verified backend-side via PyJWKClient |
| Backend | FastAPI, Python 3.12, uvicorn | Async throughout |
| Orchestration | LangGraph 0.2 | Linear 6-node graph |
| LLMs | DeepSeek V4 Flash (planning, scoring) · DeepSeek V4 Pro (synthesis) | OpenAI-compatible API |
| Embeddings | Pinecone inference — `multilingual-e5-large` (1024-dim) | No separate embedding provider needed |
| Vector DB | Pinecone serverless (AWS us-east-1), cosine | Vectors pruned after 1 day |
| Database | PostgreSQL (Railway), SQLAlchemy 2.0 async + asyncpg, Alembic | `postgresql://` URLs auto-normalized to `postgresql+asyncpg://` |
| Sources | HN Algolia API · Reddit JSON API · ArXiv API · RSS (httpx + feedparser) · Serper Google News | Reddit currently blocked (403) pending OAuth credentials |
| Email | Resend | Notebook-styled inline-CSS HTML template |
| Deploy | Vercel (frontend) · Railway (backend + Postgres + cron) | Python pinned via `.python-version` |

## Data model

Six tables (see [`backend/db/models.py`](backend/db/models.py) and [`docs/db-schema.md`](docs/db-schema.md)):

```
users ──┬── interest_profiles   (1:1 — interests text, delivery_time, timezone)
        ├── digests             (1:N — unique per user+date, status, email_sent)
        ├── articles            (1:N — raw content, scores, summary, digest_id FK)
        ├── article_feedback    (unique per user+article — "up" | "down")
        └── article_clicks      (append-only click log)
```

An article belongs to at most one digest. Delivery replaces a digest's article set atomically, and previously-delivered articles are excluded from future runs — so the archive is immutable once a day has passed.

## API reference

All routes except `/health` require `Authorization: Bearer <clerk-jwt>`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/me` | Verify token, return Clerk user id |
| GET / POST | `/api/profile` | Fetch / upsert interest profile |
| POST | `/api/pipeline/run` | Queue a pipeline run (no-op if already running) |
| GET | `/api/pipeline/status` | `{running: bool}` for the current user |
| POST | `/api/pipeline/cron` | Run all users' pipelines — guarded by `X-Cron-Secret` header (timing-safe compare) |
| GET | `/api/digest/today` | Today's digest with articles + user feedback |
| GET | `/api/digest/history?q=` | Past 30 digests; `q` searches entry titles/summaries |
| GET | `/api/digest/{id}` | One past digest (ownership-checked) |
| POST | `/api/feedback` | `{article_id, feedback: "up"|"down"}` — toggle semantics |
| POST | `/api/clicks` | `{article_id}` — log a click |

## Project structure

```
pulse-agent/
├── frontend/                  # Next.js 14 (Vercel)
│   ├── app/
│   │   ├── page.tsx           # Landing (redirects signed-in users)
│   │   ├── onboarding/        # Profile editor + starter templates
│   │   ├── dashboard/         # Today's digest, compiling view, run button
│   │   ├── history/           # Searchable archive + [id] detail pages
│   │   └── sign-in|sign-up/   # Clerk
│   ├── components/            # SiteNav, ArticleEntry, PageLoading
│   └── middleware.ts          # Clerk route protection
├── backend/                   # FastAPI (Railway)
│   ├── main.py                # App entry, CORS, routers, logging
│   ├── api/                   # health, users, profile, pipeline, digest, feedback
│   ├── agents/
│   │   ├── graph.py           # LangGraph wiring
│   │   ├── state.py           # PipelineState TypedDicts
│   │   ├── nodes/             # load_profile, crawler, store_raw, filter, synthesis, delivery
│   │   └── fetchers/          # rss, hn, reddit, arxiv, serper
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

Sign up → describe your interests (or click a starter template) → **Start my digest**. You land on the compiling view; the pipeline takes 60–90 seconds and the entries appear on their own. Watch the backend logs — every node reports progress (`[1/6] load_profile … [6/6] delivery`).

## Deployment

- **Frontend → Vercel.** Set the three frontend env vars; point `NEXT_PUBLIC_API_URL` at the Railway backend URL.
- **Backend → Railway.** Python version pinned by `backend/.python-version` (3.12). Set all backend env vars; Railway's `postgresql://` DATABASE_URL is auto-normalized for asyncpg. Add the frontend's production URL to `ALLOWED_ORIGINS`.
- **Daily digests → Railway Cron.** Schedule a job (e.g. `0 8 * * *`) running:

  ```bash
  curl -X POST https://<backend>.railway.app/api/pipeline/cron -H "X-Cron-Secret: $CRON_SECRET"
  ```

  This runs the pipeline for every user with a saved profile.

## Design system

The UI is a **notebook / field-log**: Vellum `#EDE6D6` paper, Ink `#2B2A25` text, Walnut `#8B6F47` annotations, Moss `#3D5A4C` and Wax `#B23A2E` accents, Pencil `#A8A092` metadata. Fraunces for display type, Inter for body, IBM Plex Mono for metadata. **No gradients, no shadows, no border-radius** — even the loading spinner is a square. Signature elements: double-rule mastheads, stamped tags, italic walnut margin notes ("— why this matters to you"), and thin entry rules between digest items. The email template mirrors the same system with inline CSS.

---

*Built module-by-module as an 8-week project — progress log in [`docs/progress.md`](docs/progress.md).*
