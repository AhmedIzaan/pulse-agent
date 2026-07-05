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
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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
    } catch {
      // backend unreachable — show empty state
    }
  }

  const displayDate = (digest?.date
    ? formatDate(digest.date)
    : new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
  );

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
            <span className="font-mono text-xs text-pencil">{displayDate}</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-6" />

        <SiteNav current="today" />

        {searchParams?.generating === "1" ? (
          <GeneratingView />
        ) : digest && digest.articles.length > 0 ? (
          <>
            <p className="font-mono text-[11px] text-pencil uppercase tracking-widest mb-8">
              {digest.article_count} entries · your daily field log
            </p>

            {digest.articles.map((article, i) => (
              <ArticleEntry key={article.id} article={article} isFirst={i === 0} />
            ))}
          </>
        ) : (
          <div className="py-10">
            <div className="mb-4">
              <span className="tag text-pencil border-pencil">No entries yet</span>
            </div>

            <h2 className="font-display font-semibold text-2xl text-ink tracking-tight mb-3">
              {hasProfile
                ? "Today's digest has not arrived yet."
                : "Your field log is empty."}
            </h2>

            {hasProfile ? (
              <>
                <p className="text-pencil text-sm leading-reading mb-2">
                  Your next digest arrives on schedule tomorrow morning — or you
                  can compile one right now.
                </p>
                <p className="margin-note mb-4">
                  — Ten entries, scored and summarized against your profile.
                </p>
                <RunDigestButton />
              </>
            ) : (
              <>
                <p className="text-pencil text-sm leading-reading mb-2">
                  Pulse needs to know what you follow before it can read the web
                  for you. Open the <Link href="/onboarding" className="text-walnut underline underline-offset-2">Profile</Link> tab
                  and describe your interests in plain English.
                </p>
                <p className="margin-note">
                  — Once your profile is saved, ten entries will appear here each morning.
                </p>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="entry-rule mt-16 pt-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-pencil">
              Ten entries. Every morning. Nothing more.
            </p>
            <Link
              href="/history"
              className="font-mono text-[11px] text-pencil hover:text-walnut transition-colors"
            >
              Past digests →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
