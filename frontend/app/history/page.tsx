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
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
    <div className="min-h-screen bg-vellum font-body">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Masthead */}
        <header className="flex items-baseline justify-between">
          <Link href="/dashboard" className="font-display font-black text-3xl tracking-tight text-ink hover:text-walnut transition-colors">
            PULSE
          </Link>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-pencil">Archive</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-6" />

        <SiteNav current="archive" />

        {/* Search — plain GET form, no JS needed */}
        <form method="get" className="mb-8">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search past entries..."
            className="w-full bg-vellum border border-pencil text-ink font-mono text-sm py-2 px-3 focus:outline-none focus:border-walnut placeholder:text-pencil"
          />
        </form>

        {digests.length > 0 ? (
          <>
            <p className="font-mono text-[11px] text-pencil uppercase tracking-widest mb-8">
              {q
                ? `${digests.length} ${digests.length === 1 ? "digest mentions" : "digests mention"} “${q}”`
                : `${digests.length} past ${digests.length === 1 ? "digest" : "digests"}`}
            </p>

            <div>
              {digests.map((d, i) => (
                <Link
                  key={d.id}
                  href={`/history/${d.id}`}
                  className={`block group ${i === 0 ? "pb-6" : "entry-rule pt-6 pb-6"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display font-semibold text-base text-ink tracking-tight group-hover:text-walnut transition-colors">
                        {formatDate(d.date)}
                      </p>
                      <p className="font-mono text-[10px] text-pencil mt-1">
                        {d.article_count} {d.article_count === 1 ? "entry" : "entries"}
                        {d.email_sent && " · emailed"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`tag ${d.status === "delivered" ? "text-moss border-moss" : "text-pencil border-pencil"}`}
                      >
                        {d.status}
                      </span>
                      <span className="font-mono text-xs text-pencil group-hover:text-walnut transition-colors">
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
              <span className="tag text-pencil border-pencil">
                {q ? "No matches" : "Empty"}
              </span>
            </div>
            <h2 className="font-display font-semibold text-2xl text-ink tracking-tight mb-3">
              {q ? `Nothing found for “${q}”.` : "No past digests yet."}
            </h2>
            <p className="text-pencil text-sm leading-reading mb-8">
              {q
                ? "Try a different word — search covers entry titles and summaries."
                : "Your digest history will appear here once Pulse has delivered your first digest."}
            </p>
            {q ? (
              <Link href="/history" className="btn-secondary">
                Clear search
              </Link>
            ) : (
              <Link href="/dashboard" className="btn-secondary">
                Back to dashboard
              </Link>
            )}
          </div>
        )}

        <div className="entry-rule mt-16 pt-6">
          <Link
            href="/dashboard"
            className="font-mono text-[11px] text-pencil hover:text-walnut transition-colors"
          >
            ← Today&apos;s digest
          </Link>
        </div>

      </div>
    </div>
  );
}
