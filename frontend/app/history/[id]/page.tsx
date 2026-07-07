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
  return d
    .toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
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
    <div className="min-h-screen bg-paper font-body animate-page-fade">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Ops header */}
        <header className="flex items-baseline justify-between">
          <Link
            href="/dashboard"
            className="font-display font-black text-3xl tracking-tight text-amber uppercase hover:text-amber-dim transition-colors"
          >
            MakeDigest
          </Link>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted tracking-widest">
              {digest ? formatDate(digest.date) : "ARCHIVE RECORD"}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 rule" />
        <div className="mt-[3px] rule mb-6" />

        <SiteNav current="archive" />

        {digest && digest.articles.length > 0 ? (
          <>
            <p className="font-mono text-xs text-amber uppercase tracking-widest mb-8">
              {digest.article_count} items · retrieved from archive
            </p>

            {digest.articles.map((article, i) => (
              <ArticleEntry key={article.id} article={article} index={i} />
            ))}
          </>
        ) : (
          <div className="py-10">
            <div className="mb-4">
              <span className="tag text-muted">Record not found</span>
            </div>
            <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-3 uppercase">
              This brief could not be retrieved.
            </h2>
            <p className="text-ink text-base leading-reading mb-8">
              It may have been removed, or the reference is incorrect.
            </p>
            <Link href="/history" className="btn-ghost">
              Back to archive
            </Link>
          </div>
        )}

        <div className="rule mt-16 pt-6">
          <Link
            href="/history"
            className="font-mono text-xs uppercase tracking-widest text-muted hover:text-amber transition-colors"
          >
            ← All records
          </Link>
        </div>

      </div>
    </div>
  );
}
