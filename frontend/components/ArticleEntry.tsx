export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string | null;
  why_it_matters: string | null;
  relevance_score: number | null;
  published_at: string | null;
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

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-pencil hover:text-walnut transition-colors duration-100"
      >
        Read article →
      </a>
    </article>
  );
}
