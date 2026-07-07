import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import SiteNav from "../../components/SiteNav";

type DigestSummary = {
  id: string;
  date: string;
  status: string;
  email_sent: boolean;
  article_count: number;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const { getToken } = auth();
  const token = await getToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const q = searchParams?.q?.trim() ?? "";

  let digests: DigestSummary[] = [];
  if (token) {
    try {
      const res = await fetch(
        `${apiUrl}/api/digest/history?q=${encodeURIComponent(q)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        digests = data.digests ?? [];
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
              BRIEFING ARCHIVE
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 rule" />
        <div className="mt-[3px] rule mb-8" />

        <SiteNav current="archive" />

        {/* Search — plain GET form, no JS needed */}
        <form method="get" className="mb-8">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="SEARCH ARCHIVE..."
            className="field-input w-full font-mono text-sm uppercase tracking-widest"
          />
        </form>

        {digests.length > 0 ? (
          <>
            <p className="font-mono text-xs text-amber uppercase tracking-widest mb-8">
              {q
                ? `${digests.length} ${digests.length === 1 ? "record matches" : "records match"} "${q}"`
                : `${digests.length} ${digests.length === 1 ? "record" : "records"} on file`}
            </p>

            <div>
              {digests.map((d, i) => (
                <Link
                  key={d.id}
                  href={`/history/${d.id}`}
                  className={`block group ${i === 0 ? "pb-6" : "rule pt-6 pb-6"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-xs text-amber uppercase tracking-widest mb-1">
                        #{String(digests.length - i).padStart(4, "0")}
                      </p>
                      <p className="font-display font-semibold text-lg text-ink tracking-tight group-hover:text-amber transition-colors uppercase">
                        {formatDate(d.date)}
                      </p>
                      <p className="font-mono text-xs text-muted uppercase tracking-widest mt-1">
                        {d.article_count} {d.article_count === 1 ? "item" : "items"}
                        {d.email_sent && " · transmitted"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`tag ${d.status === "delivered" ? "text-amber" : "text-muted"}`}
                      >
                        {d.status}
                      </span>
                      <span className="font-mono text-xs text-muted group-hover:text-amber transition-colors">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="py-10">
            <div className="mb-4">
              <span className="tag text-muted">
                {q ? "No matches" : "No intel available"}
              </span>
            </div>
            <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-3 uppercase">
              {q ? `Nothing found for "${q}".` : "No briefs on file."}
            </h2>
            <p className="text-ink text-base leading-reading mb-8">
              {q
                ? "Try a different term — search covers item headlines and field reports."
                : "Your briefing archive will populate once agents deliver your first brief."}
            </p>
            {q ? (
              <Link href="/history" className="btn-ghost">
                Clear search
              </Link>
            ) : (
              <Link href="/dashboard" className="btn-ghost">
                Back to operations
              </Link>
            )}
          </div>
        )}

        <div className="rule mt-16 pt-6">
          <Link
            href="/dashboard"
            className="font-mono text-xs uppercase tracking-widest text-muted hover:text-amber transition-colors"
          >
            ← Today&apos;s brief
          </Link>
        </div>

      </div>
    </div>
  );
}
