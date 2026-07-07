import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import RunDigestButton from "./RunDigestButton";
import GeneratingView from "./GeneratingView";
import SiteNav from "../../components/SiteNav";
import ArticleEntry, { type Article } from "../../components/ArticleEntry";

type Digest = {
  id: string;
  date: string;
  status: string;
  article_count: number;
  articles: Article[];
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d
    .toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function estimateReadingMinutes(articles: Article[]): number {
  const words = articles.reduce((sum, a) => {
    const text = `${a.summary ?? ""} ${a.why_it_matters ?? ""}`;
    return sum + text.split(/\s+/).filter(Boolean).length;
  }, 0);
  return Math.max(1, Math.round(words / 200));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { generating?: string };
}) {
  const { getToken } = auth();
  const token = await getToken();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let digest: Digest | null = null;
  let hasProfile = false;
  let paused = false;
  if (token) {
    try {
      const [digestRes, profileRes] = await Promise.all([
        fetch(`${apiUrl}/api/digest/today`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${apiUrl}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);
      if (digestRes.ok) {
        digest = await digestRes.json();
      }
      hasProfile = profileRes.ok;
      if (profileRes.ok) {
        const profile = await profileRes.json();
        paused = Boolean(profile.paused);
      }
    } catch {
      // backend unreachable — show empty state
    }
  }

  const hasEntries = Boolean(digest && digest.articles.length > 0);
  const todayLabel = formatDate(digest?.date ?? new Date().toISOString().slice(0, 10));

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
              DAILY BRIEF · {todayLabel}
              {digest?.created_at && ` · ${formatTime(digest.created_at)}`}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 rule" />
        <div className="mt-[3px] rule mb-2" />

        {/* Agent status strip */}
        <div className="flex items-center gap-2 py-3 mb-6">
          {paused ? (
            <>
              <span className="w-1.5 h-1.5 bg-urgent shrink-0" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted">
                Stand-down in effect ·{" "}
                <Link href="/onboarding" className="text-amber hover:text-amber-dim transition-colors">
                  Resume operations
                </Link>
              </span>
            </>
          ) : (
            <>
              <span className={`pulse-dot ${hasEntries ? "" : "opacity-40"}`} style={hasEntries ? { animation: "none" } : undefined} />
              <span className="font-mono text-xs uppercase tracking-widest text-muted">
                {hasEntries ? "Brief ready" : "Standing by"}
              </span>
            </>
          )}
        </div>

        <SiteNav current="operations" />

        {searchParams?.generating === "1" ? (
          <GeneratingView />
        ) : hasEntries && digest ? (
          <>
            <div className="mb-10">
              <p className="font-mono text-xs text-amber uppercase tracking-widest mb-2">
                Situation report · {todayLabel}
              </p>
              <div className="rule-section mb-3" />
              <p className="text-ink text-base leading-reading">
                {digest.article_count} items compiled. Estimated reading time:{" "}
                {estimateReadingMinutes(digest.articles)} minutes.
              </p>
            </div>

            {digest.articles.map((article, i) => (
              <ArticleEntry key={article.id} article={article} index={i} />
            ))}
          </>
        ) : (
          <div className="py-10">
            <div className="mb-4">
              <span className="tag text-muted">No intel available</span>
            </div>

            <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-3 uppercase">
              {hasProfile ? "Brief not yet compiled." : "No configuration on file."}
            </h2>

            {hasProfile ? (
              <>
                <p className="text-ink text-base leading-reading mb-4">
                  {paused
                    ? "Agents are standing down — no briefs compile until you resume operations. You can still run them manually below."
                    : "Your next brief compiles on schedule tomorrow morning — or run your agents now."}
                </p>
                <div className="analyst-note mb-6">
                  <span className="analyst-note-label">Analyst note</span>
                  <p className="text-ink text-base italic leading-reading">
                    Ten items, scored and summarized against your configuration.
                  </p>
                </div>
                <RunDigestButton />
              </>
            ) : (
              <>
                <p className="text-ink text-base leading-reading mb-4">
                  Agents have not been configured to monitor any topics yet.
                  Open{" "}
                  <Link href="/onboarding" className="text-amber underline underline-offset-2">
                    Configuration
                  </Link>{" "}
                  and describe what to track.
                </p>
                <div className="analyst-note">
                  <span className="analyst-note-label">Analyst note</span>
                  <p className="text-ink text-base italic leading-reading">
                    Once configured, ten items will compile here each morning.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="rule mt-16 pt-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">
              Agents operate continuously. Ten items. Every morning.
            </p>
            <Link
              href="/history"
              className="font-mono text-xs uppercase tracking-widest text-muted hover:text-amber transition-colors"
            >
              View archive →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
