import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const SAMPLE_ENTRIES = [
  {
    tag: "AI Research",
    tagColor: "text-moss border-moss",
    title: "Anthropic releases interpretability findings on chain-of-thought faithfulness",
    body: "Researchers found that models sometimes reason correctly in scratchpads while producing outputs inconsistent with that reasoning — raising questions about whether visible reasoning is the actual decision process.",
    annotation: "Directly relevant to your interest in AI safety tooling — the gap between stated and actual reasoning is the core problem you have been tracking.",
    source: "arxiv.org",
    time: "06:14",
  },
  {
    tag: "Developer Tools",
    tagColor: "text-walnut border-walnut",
    title: "LangGraph 0.3 ships persistent memory across graph runs without external stores",
    body: "The new in-process memory layer lets long-running agents maintain state across interruptions without Redis or a vector DB. Early benchmarks show 40% reduction in round-trip latency for multi-step pipelines.",
    annotation: "This lands exactly on the architecture problem you described — worth reading the migration guide before your next sprint.",
    source: "blog.langchain.dev",
    time: "07:02",
  },
  {
    tag: "Startups",
    tagColor: "text-pencil border-pencil",
    title: "Y Combinator W26 batch: 18 of 240 companies are infrastructure plays for AI agents",
    body: "The proportion of agent-infrastructure companies in the batch has doubled since S25. Most are targeting the orchestration and observability layer rather than foundation models.",
    annotation: "The segment you follow is now 7.5% of YC's intake — the market signal you were watching for is here.",
    source: "techcrunch.com",
    time: "05:48",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Tell Pulse what you follow",
    body: "Write in plain English. Topics, papers, communities, companies — anything you want to track. No categories to pick from, no checkboxes.",
  },
  {
    step: "02",
    title: "Pulse reads the web overnight",
    body: "Crawls Hacker News, Reddit, ArXiv, RSS feeds, and Google News. Each article is scored for relevance to your exact profile. Noise is dropped.",
  },
  {
    step: "03",
    title: "Ten entries arrive each morning",
    body: "Every entry has a three-sentence summary and one line explaining why it matters to you specifically. Your inbox, not an algorithm's feed.",
  },
];

const SOURCES = ["Hacker News", "Reddit", "ArXiv", "RSS feeds", "Google News"];

function today() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function HomePage() {
  const { userId } = auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-vellum font-body">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* ── Masthead ── */}
        <header className="flex items-baseline justify-between">
          <span className="font-display font-black text-3xl tracking-tight text-ink">
            PULSE
          </span>
          <div className="flex items-center gap-6">
            <span className="font-mono text-xs text-pencil">{today()}</span>
            <Link
              href="/sign-in"
              className="font-mono text-xs text-walnut underline underline-offset-2"
            >
              Sign in
            </Link>
          </div>
        </header>

        {/* Double rule */}
        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-10" />

        {/* ── Hero ── */}
        <div className="mb-10">
          <div className="mb-4">
            <span className="tag text-moss border-moss">Daily field log</span>
          </div>

          <h1 className="font-display font-black text-4xl text-ink tracking-tight leading-tight mb-5">
            Ten things worth reading.<br />Every morning. Nothing more.
          </h1>

          <p className="text-ink text-base leading-reading mb-3">
            Pulse is a personalized research digest for people who follow ideas seriously.
            Tell it what you care about — it reads Hacker News, Reddit, ArXiv, and the broader
            web overnight, filters the noise, and delivers exactly ten entries tailored to you.
          </p>

          <p className="margin-note mb-8">
            — Not a feed. Not a newsletter. A daily log of what moved in your field.
          </p>

          <div className="flex gap-3">
            <Link href="/sign-up" className="btn-wax">
              Start your digest
            </Link>
          </div>
        </div>

        {/* Single rule */}
        <div className="entry-rule mb-10" />

        {/* ── How it works ── */}
        <div className="mb-2">
          <span className="font-mono text-xs text-pencil uppercase tracking-widest">
            How it works
          </span>
        </div>
        <h2 className="font-display font-bold text-2xl text-ink tracking-tight mb-8">
          Three steps. No configuration.
        </h2>

        <div className="space-y-8 mb-10">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="flex gap-6">
              <span className="font-mono text-xs text-pencil mt-1 shrink-0 w-6">
                {item.step}
              </span>
              <div>
                <p className="font-display font-semibold text-base text-ink mb-1">
                  {item.title}
                </p>
                <p className="text-pencil text-sm leading-reading">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sources */}
        <div className="flex flex-wrap gap-2 mb-10">
          {SOURCES.map((s) => (
            <span key={s} className="tag text-pencil border-pencil">
              {s}
            </span>
          ))}
        </div>

        {/* Single rule */}
        <div className="entry-rule mb-10" />

        {/* ── Sample digest ── */}
        <div className="mb-5">
          <span className="font-mono text-xs text-pencil uppercase tracking-widest">
            Sample digest · {today()}
          </span>
        </div>
        <p className="text-pencil text-sm mb-8">
          This is what your morning log looks like. Entries, summaries,
          and a margin note explaining why each one matters to you.
        </p>

        {SAMPLE_ENTRIES.map((entry, i) => (
          <article key={i} className={i > 0 ? "entry-rule pt-6 mt-6" : ""}>
            <div className="mb-2">
              <span className={`tag ${entry.tagColor}`}>{entry.tag}</span>
            </div>
            <h3 className="font-display font-semibold text-xl text-ink leading-tight tracking-tight mb-3">
              {entry.title}
            </h3>
            <p className="text-ink text-sm leading-reading mb-3">{entry.body}</p>
            <p className="margin-note">— {entry.annotation}</p>
            <div className="flex gap-4 mt-3">
              <span className="font-mono text-xs text-pencil">{entry.source}</span>
              <span className="font-mono text-xs text-pencil">{entry.time}</span>
            </div>
          </article>
        ))}

        {/* Single rule */}
        <div className="entry-rule mt-10 mb-10" />

        {/* ── Bottom CTA ── */}
        <div className="mb-2">
          <span className="tag text-walnut border-walnut">Free to start</span>
        </div>
        <h2 className="font-display font-bold text-2xl text-ink tracking-tight mb-3">
          Your first digest arrives tomorrow morning.
        </h2>
        <p className="text-pencil text-sm leading-reading mb-8">
          Set up your profile in two minutes. Pulse handles the rest overnight.
          No credit card. No onboarding call.
        </p>
        <Link href="/sign-up" className="btn-wax">
          Start your digest
        </Link>

        {/* ── Footer ── */}
        <div className="entry-rule mt-16 pt-6 flex items-baseline justify-between">
          <p className="font-mono text-xs text-pencil">
            Ten entries. Every morning. Nothing more.
          </p>
          <span className="font-display font-black text-sm text-ink">PULSE</span>
        </div>

      </div>
    </div>
  );
}
