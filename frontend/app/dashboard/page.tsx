import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

function today() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-vellum font-body">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Masthead */}
        <header className="flex items-baseline justify-between">
          <span className="font-display font-black text-3xl tracking-tight text-ink">
            PULSE
          </span>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-pencil">{today()}</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        {/* Double rule */}
        <div className="mt-3 border-t border-pencil" />
        <div className="mt-[3px] border-t border-pencil mb-8" />

        {/* Empty state */}
        <div className="py-10">
          <div className="mb-4">
            <span className="tag text-pencil border-pencil">No entries yet</span>
          </div>

          <h2 className="font-display font-semibold text-2xl text-ink tracking-tight mb-3">
            Your first digest has not arrived yet.
          </h2>

          <p className="text-pencil text-sm leading-reading mb-2">
            Set up your interest profile and Pulse will start building your daily log.
            Your first digest will arrive the next morning after you finish onboarding.
          </p>

          <p className="margin-note mb-8">
            — Once your digest is ready, ten entries will appear here each morning.
          </p>

          <Link href="/onboarding" className="btn-wax">
            Set up your profile
          </Link>
        </div>

        {/* Footer rule */}
        <div className="entry-rule mt-16 pt-6">
          <p className="font-mono text-xs text-pencil">
            Ten entries. Every morning. Nothing more.
          </p>
        </div>

      </div>
    </div>
  );
}
