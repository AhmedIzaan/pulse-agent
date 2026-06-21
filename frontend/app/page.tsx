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
    tag: "Systems",
    tagColor: "text-walnut border-walnut",
    title: "Linux 6.10 lands memory-folios optimization, showing 8% throughput gain in benchmarks",
    body: "The folio work merged over the last two kernel cycles finally lands measurable gains in real-world file I/O workloads, particularly for large sequential reads common in database and ML training pipelines.",
    annotation: "Worth a close read if you are still profiling the data loader bottleneck — the gains are in exactly the path you were benchmarking.",
    source: "lwn.net",
    time: "05:52",
  },
];

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

        {/* Masthead */}
        <header className="flex items-baseline justify-between">
          <span className="font-display font-black text-3xl tracking-tight text-ink">
            PULSE
          </span>
          <span className="font-mono text-xs text-pencil">{today()}</span>
        </header>

        {/* Double rule */}
        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-8" />

        {/* Lede */}
        <p className="text-ink text-base leading-reading mb-2">
          A daily field log, built for people who follow ideas seriously.
        </p>
        <p className="text-pencil text-sm leading-reading mb-8">
          Tell Pulse what you care about. Every morning it reads the web for you — research papers,
          developer forums, industry news — filters the noise, and delivers ten entries worth your time.
        </p>

        <div className="flex gap-3 mb-14">
          <Link href="/sign-up" className="btn-wax">
            Start your digest
          </Link>
          <Link href="/sign-in" className="btn-secondary">
            Sign in
          </Link>
        </div>

        {/* Sample entries */}
        <div className="mb-5">
          <span className="font-mono text-xs text-pencil uppercase tracking-widest">
            Sample · {today()}
          </span>
        </div>

        {SAMPLE_ENTRIES.map((entry, i) => (
          <article key={i} className={i > 0 ? "entry-rule pt-6 mt-6" : ""}>
            <div className="mb-2">
              <span className={`tag ${entry.tagColor}`}>{entry.tag}</span>
            </div>
            <h2 className="font-display font-semibold text-xl text-ink leading-tight tracking-tight mb-3">
              {entry.title}
            </h2>
            <p className="text-ink text-sm leading-reading mb-3">{entry.body}</p>
            <p className="margin-note">— {entry.annotation}</p>
            <div className="flex gap-4 mt-3">
              <span className="font-mono text-xs text-pencil">{entry.source}</span>
              <span className="font-mono text-xs text-pencil">{entry.time}</span>
            </div>
          </article>
        ))}

        {/* Footer rule */}
        <div className="entry-rule mt-10 pt-6">
          <p className="font-mono text-xs text-pencil">
            Ten entries. Every morning. Nothing more.
          </p>
        </div>

      </div>
    </div>
  );
}
