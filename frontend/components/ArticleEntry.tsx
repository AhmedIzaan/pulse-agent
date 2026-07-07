"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string | null;
  why_it_matters: string | null;
  relevance_score: number | null;
  published_at: string | null;
  feedback?: "up" | "down" | null;
};

function timeAgo(isoString: string | null): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1H AGO";
  if (h < 24) return `${h}H AGO`;
  return `${Math.floor(h / 24)}D AGO`;
}

export default function ArticleEntry({
  article,
  index,
}: {
  article: Article;
  index: number;
}) {
  const { getToken } = useAuth();
  const [feedback, setFeedback] = useState<"up" | "down" | null>(
    article.feedback ?? null
  );

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const refNumber = `#${String(index + 1).padStart(4, "0")}`;

  async function post(path: string, body: object) {
    try {
      const token = await getToken();
      return await fetch(`${apiUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      return null;
    }
  }

  function logClick() {
    // fire-and-forget — never block the navigation
    post("/api/clicks", { article_id: article.id });
  }

  async function handleFeedback(value: "up" | "down") {
    const previous = feedback;
    // optimistic: same button toggles off, other button switches
    setFeedback(previous === value ? null : value);
    const res = await post("/api/feedback", {
      article_id: article.id,
      feedback: value,
    });
    if (!res || !res.ok) setFeedback(previous);
  }

  return (
    <article className="file-entry py-1 mb-10 last:mb-0">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] tracking-widest text-amber uppercase">
          {refNumber} · {article.source}
        </span>
        {article.published_at && (
          <span className="font-mono text-[11px] tracking-widest text-muted">
            {timeAgo(article.published_at)}
          </span>
        )}
      </div>

      <h2 className="font-display font-bold text-3xl text-ink leading-tight tracking-tight mb-3">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={logClick}
          className="hover:text-amber transition-colors duration-100"
        >
          {article.title}
        </a>
      </h2>

      {article.summary && (
        <p className="text-ink text-base leading-reading mb-4">{article.summary}</p>
      )}

      {article.why_it_matters && (
        <div className="analyst-note mb-4">
          <span className="analyst-note-label">Analyst note</span>
          <p className="text-ink text-base italic leading-reading">
            {article.why_it_matters}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={logClick}
          className="font-mono text-xs uppercase tracking-widest text-amber-dim hover:text-amber transition-colors duration-100"
        >
          Open source →
        </a>

        <button
          onClick={() => handleFeedback("up")}
          aria-label="Relevant"
          title="Relevant"
          className={`font-mono text-xs uppercase tracking-widest transition-colors duration-100 ${
            feedback === "up" ? "text-amber" : "text-muted hover:text-amber"
          }`}
        >
          ▲ Relevant
        </button>

        <button
          onClick={() => handleFeedback("down")}
          aria-label="Disregard"
          title="Disregard"
          className={`font-mono text-xs uppercase tracking-widest transition-colors duration-100 ${
            feedback === "down" ? "text-amber" : "text-muted hover:text-amber"
          }`}
        >
          ▼ Disregard
        </button>
      </div>
    </article>
  );
}
