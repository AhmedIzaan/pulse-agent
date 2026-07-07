"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FIELD_NOTES = [
  "Read fewer things, more deeply. One idea fully understood beats ten skimmed.",
  "The best insights arrive in the margins — keep a pen near everything you read.",
  "Attention is a budget. Spend it where compound interest applies.",
  "A walk after reading does more for retention than a second reading.",
  "Write down what surprised you. Surprise is the signature of real learning.",
  "Slow information beats fast information. News expires; ideas do not.",
  "The person who asks the obvious question usually understands the most.",
  "Boredom is not a problem to solve. It is where your own thoughts live.",
  "You do not need to hold an opinion on everything that happens today.",
  "Sleep is part of thinking. The unsolved problem tonight is solved at dawn.",
];

// Illustrative sequence only — not tied to real per-node progress, since the
// backend only reports whether a run is in flight, not which node it's on.
const AGENT_STAGES = ["CRAWLER", "FILTER", "SYNTHESIS", "DELIVERY"];

export default function GeneratingView() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [noteIndex, setNoteIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const sawRunning = useRef(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    const noteTimer = setInterval(() => {
      setNoteIndex((i) => (i + 1) % FIELD_NOTES.length);
    }, 6000);

    const stageTimer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, AGENT_STAGES.length - 1));
    }, 9000);

    let attempts = 0;
    const maxAttempts = 120; // 4s × 120 = 8 minutes

    function finish() {
      clearInterval(poll);
      clearInterval(noteTimer);
      clearInterval(stageTimer);
      router.replace("/dashboard");
      router.refresh();
    }

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${apiUrl}/api/pipeline/status`, {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        if (res.ok) {
          const { running } = await res.json();
          if (running) {
            sawRunning.current = true;
          } else if (sawRunning.current || attempts >= 4) {
            finish();
            return;
          }
        }
      } catch {
        // transient network error — keep polling
      }
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        clearInterval(noteTimer);
        clearInterval(stageTimer);
        setFailed(true);
      }
    }, 4000);

    return () => {
      clearInterval(poll);
      clearInterval(noteTimer);
      clearInterval(stageTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div className="py-10">
        <div className="mb-4">
          <span className="tag text-urgent">Signal lost</span>
        </div>
        <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-3 uppercase">
          This is taking longer than it should.
        </h2>
        <p className="text-ink text-base leading-reading mb-8">
          Agents may still be compiling in the background. Reload in a minute —
          your brief will appear once it lands.
        </p>
        <button onClick={() => router.refresh()} className="btn-ghost">
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="py-16 flex flex-col items-center text-center">
      <p className="font-mono text-xs text-amber uppercase tracking-widest mb-6">
        Compiling brief...
      </p>

      {/* Agent status readout */}
      <div className="flex items-center gap-3 mb-10 font-mono text-xs uppercase tracking-widest">
        {AGENT_STAGES.map((stage, i) => (
          <span key={stage} className="flex items-center gap-3">
            <span className={i <= stageIndex ? "text-amber" : "text-muted"}>
              {stage} {i < stageIndex ? "✓" : i === stageIndex ? "···" : ""}
            </span>
            {i < AGENT_STAGES.length - 1 && <span className="text-line">/</span>}
          </span>
        ))}
      </div>

      <h2 className="font-display font-bold text-3xl text-ink tracking-tight mb-10 uppercase">
        Reading the web so you don&apos;t have to.
      </h2>

      {/* Rotating field note */}
      <div className="max-w-md min-h-[4rem]">
        <div key={noteIndex} className="analyst-note text-left inline-block animate-field-note-fade">
          <span className="analyst-note-label">Field note</span>
          <p className="text-ink text-base italic leading-reading">
            {FIELD_NOTES[noteIndex]}
          </p>
        </div>
      </div>

      <p className="font-mono text-xs text-muted uppercase tracking-widest mt-10">
        Usually 60–90 seconds. The brief will appear on its own.
      </p>
    </div>
  );
}
