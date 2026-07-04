import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import SiteNav from "../../../components/SiteNav";
import ArticleEntry, { type Article } from "../../../components/ArticleEntry";

type Digest = {
  id: string;
  date: string;
  status: string;
  article_count: number;
  articles: Article[];
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DigestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { getToken } = auth();
  const token = await getToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let digest: Digest | null = null;
  if (token) {
    try {
      const res = await fetch(`${apiUrl}/api/digest/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        digest = await res.json();
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-vellum font-body">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Masthead */}
        <header className="flex items-baseline justify-between">
          <Link
            href="/dashboard"
            className="font-display font-black text-3xl tracking-tight text-ink hover:text-walnut transition-colors"
          >
            PULSE
          </Link>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-pencil">
              {digest ? formatDate(digest.date) : "Archive"}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-6" />

        <SiteNav current="archive" />

        {digest && digest.articles.length > 0 ? (
          <>
            <p className="font-mono text-[11px] text-pencil uppercase tracking-widest mb-8">
              {digest.article_count} entries · from the archive
            </p>

            {digest.articles.map((article, i) => (
              <ArticleEntry key={article.id} article={article} isFirst={i === 0} />
            ))}
          </>
        ) : (
          <div className="py-10">
            <div className="mb-4">
              <span className="tag text-pencil border-pencil">Not found</span>
            </div>
            <h2 className="font-display font-semibold text-2xl text-ink tracking-tight mb-3">
              This digest could not be loaded.
            </h2>
            <p className="text-pencil text-sm leading-reading mb-8">
              It may have been removed, or the link is incorrect.
            </p>
            <Link href="/history" className="btn-secondary">
              Back to archive
            </Link>
          </div>
        )}

        <div className="entry-rule mt-16 pt-6">
          <Link
            href="/history"
            className="font-mono text-[11px] text-pencil hover:text-walnut transition-colors"
          >
            ← All past digests
          </Link>
        </div>

      </div>
    </div>
  );
}
