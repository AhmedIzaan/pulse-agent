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
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ArticleEntry({
  article,
  isFirst,
}: {
  article: Article;
  isFirst: boolean;
}) {
  const { getToken } = useAuth();
  const [feedback, setFeedback] = useState<"up" | "down" | null>(
    article.feedback ?? null
  );

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
    <article className={isFirst ? "pb-8" : "entry-rule pt-8 pb-8"}>
      <div className="flex items-center gap-3 mb-3">
        <span className="tag text-walnut border-walnut">{article.source}</span>
        {article.published_at && (
          <span className="font-mono text-[10px] text-pencil">
            {timeAgo(article.published_at)}
          </span>
        )}
      </div>

      <h2 className="font-display font-semibold text-xl text-ink tracking-tight leading-snug mb-3">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={logClick}
          className="hover:text-walnut transition-colors duration-100"
        >
          {article.title}
        </a>
      </h2>

      {article.summary && (
        <p className="text-ink text-sm leading-reading mb-3">{article.summary}</p>
      )}

      {article.why_it_matters && (
        <p className="margin-note mb-4">— {article.why_it_matters}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={logClick}
          className="font-mono text-[11px] text-pencil hover:text-walnut transition-colors duration-100"
        >
          Read article →
        </a>

        <button
          onClick={() => handleFeedback("up")}
          aria-label="More like this"
          title="More like this"
          className={`font-mono text-[11px] transition-colors duration-100 ${
            feedback === "up"
              ? "text-moss"
              : "text-pencil hover:text-moss"
          }`}
        >
          ▲ more like this
        </button>

        <button
          onClick={() => handleFeedback("down")}
          aria-label="Less like this"
          title="Less like this"
          className={`font-mono text-[11px] transition-colors duration-100 ${
            feedback === "down"
              ? "text-wax"
              : "text-pencil hover:text-wax"
          }`}
        >
          ▼ less
        </button>
      </div>
    </article>
  );
}
