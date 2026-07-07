import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MarginConsole from "../components/MarginConsole";
import MissionDemo from "../components/MissionDemo";

const AGENTS = [
  {
    num: "01",
    name: "The Crawler",
    body: "Scouts 50+ sources every night — news sites, Reddit, ArXiv, blogs, and more. It doesn't have a fixed list. It reasons from your interests and decides where to look.",
  },
  {
    num: "02",
    name: "The Filter",
    body: "Reads everything the Crawler finds. Keeps what's relevant to you. Discards the rest. Out of 300 articles, you'll see 10. The ones that actually matter.",
  },
  {
    num: "03",
    name: "The Analyst",
    body: "Doesn't just summarize. For every item it keeps, it writes one line explaining why it matters specifically to you — not to everyone, to you.",
  },
  {
    num: "04",
    name: "The Courier",
    body: "Assembles your brief and delivers it. To your inbox, to your dashboard, at the exact time you choose. Every morning, without fail.",
  },
];

const WHY_POINTS = [
  {
    title: "It gets smarter.",
    body: "The more you read, the better it knows you. Click what interests you, skip what doesn't — your agents adjust.",
  },
  {
    title: "It respects your time.",
    body: "Six minutes. That's the average time to read a full brief. Not an hour of scrolling. Not a 47-tab rabbit hole.",
  },
  {
    title: "It's actually personal.",
    body: "Not personalized by algorithm. Personalized because four agents are reasoning about your specific interests — not clustering you into a demographic.",
  },
  {
    title: "It works while you sleep.",
    body: "No prompting, no refreshing, no asking. Your agents run on a schedule. Your brief is waiting when you open your eyes.",
  },
];

const SOURCES = ["Hacker News", "Reddit", "ArXiv", "RSS Feeds", "Google News"];

const SAMPLE_CONFIGURATIONS = [
  "Rust programming and generative music",
  "Climate policy and venture capital",
  "Retro game dev and Japanese cinema",
];

const SAMPLE_ENTRIES = [
  {
    source: "ARXIV",
    title: "Anthropic releases interpretability findings on chain-of-thought faithfulness",
    body: "Researchers found that models sometimes reason correctly in scratchpads while producing outputs inconsistent with that reasoning — raising questions about whether visible reasoning is the actual decision process.",
    note: "Directly relevant to your interest in AI safety tooling — the gap between stated and actual reasoning is the core problem you have been tracking.",
    time: "3H AGO",
  },
  {
    source: "RSS",
    title: "LangGraph 0.3 ships persistent memory across graph runs without external stores",
    body: "The new in-process memory layer lets long-running agents maintain state across interruptions without Redis or a vector DB. Early benchmarks show 40% reduction in round-trip latency for multi-step pipelines.",
    note: "This lands exactly on the architecture problem you described — worth reading the migration guide before your next sprint.",
    time: "5H AGO",
  },
  {
    source: "SERPER",
    title: "Y Combinator W26 batch: 18 of 240 companies are infrastructure plays for AI agents",
    body: "The proportion of agent-infrastructure companies in the batch has doubled since S25. Most are targeting the orchestration and observability layer rather than foundation models.",
    note: "The segment you follow is now 7.5% of YC's intake — the market signal you were watching for is here.",
    time: "8H AGO",
  },
];

function today() {
  return new Date()
    .toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export default async function HomePage() {
  const { userId } = auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-paper font-body animate-page-fade">
      <MarginConsole />
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-10">

        {/* Ops header */}
        <header className="flex items-baseline justify-between">
          <span className="font-display font-black text-3xl tracking-tight text-amber uppercase">
            MakeDigest
          </span>
          <div className="flex items-center gap-6">
            <span className="font-mono text-xs text-muted tracking-widest">{today()}</span>
            <Link
              href="/sign-in"
              className="font-mono text-xs uppercase tracking-widest text-amber underline underline-offset-2"
            >
              Sign in
            </Link>
          </div>
        </header>

        <div className="mt-3 rule" />
        <div className="mt-[3px] rule mb-12" />

        {/* ── Hero ── */}
        <div className="mb-16 max-w-3xl">
          <div className="mb-4">
            <span className="tag text-amber">Four agents. One brief. Every morning.</span>
          </div>

          <h1 className="font-display font-black text-6xl md:text-7xl text-ink tracking-tight leading-[0.95] mb-6 uppercase">
            The web read.<br />So you don&apos;t have to.
          </h1>

          <p className="text-ink text-lg leading-reading mb-8 max-w-xl">
            Tell us what you care about — in plain English. Our agents go out
            overnight, scan hundreds of sources, cut the noise, and file your
            personal brief before you wake up.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className="btn-primary">
              Deploy your agents
            </Link>
            <a href="#sample-brief" className="btn-ghost">
              See a sample brief
            </a>
          </div>
        </div>

        <div className="rule-section mb-12" />

        {/* ── Agent breakdown ── */}
        <div className="mb-2">
          <span className="font-mono text-xs text-muted uppercase tracking-widest">
            Meet your team
          </span>
        </div>
        <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-2 uppercase">
          Four agents work through the night
        </h2>
        <p className="text-ink text-lg leading-reading mb-8 max-w-xl">
          So your morning takes six minutes, not sixty.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 mb-12">
          {AGENTS.map((agent) => (
            <div key={agent.num} className="file-entry py-1">
              <span className="font-mono text-xs text-amber uppercase tracking-widest">
                Agent {agent.num}
              </span>
              <p className="font-display font-bold text-2xl text-ink tracking-tight mt-1 mb-2 uppercase">
                {agent.name}
              </p>
              <p className="text-ink text-base leading-reading">{agent.body}</p>
            </div>
          ))}
        </div>

        {/* ── Sources monitored ── */}
        <div className="mb-2">
          <span className="font-mono text-xs text-muted uppercase tracking-widest">
            Sources monitored
          </span>
        </div>
        <p className="text-ink text-base leading-reading mb-4 max-w-xl">
          No invented headlines, no hallucinated citations. Every item in your
          brief links back to where it was actually published.
        </p>
        <div className="flex flex-wrap gap-2 mb-12">
          {SOURCES.map((s) => (
            <span key={s} className="tag text-amber">
              {s}
            </span>
          ))}
        </div>

        <div className="rule-section mb-12" />

        {/* ── How it works ── */}
        <div className="mb-2">
          <span className="font-mono text-xs text-muted uppercase tracking-widest">
            Operating procedure
          </span>
        </div>
        <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-8 uppercase">
          Up and running in two minutes
        </h2>

        <div className="mb-12 max-w-3xl">
          <MissionDemo />
        </div>

        <div className="rule-section mb-12" />

        {/* ── Why MakeDigest ── */}
        <div className="mb-2">
          <span className="font-mono text-xs text-muted uppercase tracking-widest">
            Why MakeDigest
          </span>
        </div>
        <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-8 uppercase">
          Not a newsletter. Not a feed. A brief.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 mb-12">
          {WHY_POINTS.map((point) => (
            <div key={point.title} className="file-entry py-1">
              <p className="font-display font-semibold text-xl text-amber mb-1 uppercase tracking-tight">
                {point.title}
              </p>
              <p className="text-ink text-base leading-reading">{point.body}</p>
            </div>
          ))}
        </div>

        <div className="rule-section mb-12" />

        {/* ── Sample brief ── */}
        <div id="sample-brief" className="mb-2 scroll-mt-10">
          <span className="font-mono text-xs text-amber uppercase tracking-widest">
            Situation report · sample
          </span>
        </div>
        <p className="text-ink text-lg mb-8 max-w-xl">
          This is what a brief looks like on arrival. Field reports, analyst
          notes, and nothing you didn&apos;t ask for.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10 mb-12 items-start">
          {SAMPLE_ENTRIES.map((entry, i) => (
            <article key={i} className="file-entry py-1">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs tracking-widest text-amber uppercase">
                  #{String(i + 1).padStart(4, "0")} · {entry.source}
                </span>
                <span className="font-mono text-xs tracking-widest text-muted">
                  {entry.time}
                </span>
              </div>
              <h3 className="font-display font-bold text-3xl text-ink leading-tight tracking-tight mb-3">
                {entry.title}
              </h3>
              <p className="text-ink text-base leading-reading mb-4">{entry.body}</p>
              <div className="analyst-note">
                <span className="analyst-note-label">Analyst note</span>
                <p className="text-ink text-base italic leading-reading">{entry.note}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="rule-section mb-12" />

        {/* ── Social proof ── */}
        <div className="mb-2">
          <span className="font-mono text-xs text-muted uppercase tracking-widest">
            On file
          </span>
        </div>
        <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-8 uppercase">
          What people are reading about
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {SAMPLE_CONFIGURATIONS.map((config, i) => (
            <div key={config} className="analyst-note">
              <span className="analyst-note-label">Configuration #{String(i + 1).padStart(4, "0")}</span>
              <p className="text-ink text-base italic leading-reading">
                &ldquo;{config}&rdquo;
              </p>
            </div>
          ))}
        </div>

        <div className="rule-section mb-12" />

        {/* ── Final CTA ── */}
        <div className="max-w-xl mb-16">
          <div className="mb-2">
            <span className="tag text-amber">Free to deploy</span>
          </div>
          <h2 className="font-display font-bold text-4xl text-ink tracking-tight mb-3 uppercase">
            Your first brief is one conversation away.
          </h2>
          <p className="text-ink text-lg leading-reading mb-8">
            Tell us what matters to you. We&apos;ll handle everything else.
          </p>
          <Link href="/sign-up" className="btn-primary">
            Deploy your agents
          </Link>
          <p className="font-mono text-xs text-muted uppercase tracking-widest mt-4">
            Free to start. No credit card required. Your brief arrives tomorrow morning.
          </p>
        </div>

        {/* Footer */}
        <div className="rule pt-6 flex items-baseline justify-between">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">
            Agents operate continuously. Ten items. Every morning.
          </p>
          <span className="font-display font-black text-sm text-amber uppercase">MakeDigest</span>
        </div>

      </div>
    </div>
  );
}
