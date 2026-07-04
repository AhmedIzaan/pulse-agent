"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TIPS = [
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

export default function GeneratingView() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [tipIndex, setTipIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const sawRunning = useRef(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 6000);

    let attempts = 0;
    const maxAttempts = 120; // 4s × 120 = 8 minutes

    function finish() {
      clearInterval(poll);
      clearInterval(tipTimer);
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
            // Done — or it never started within the ~16s grace period
            // (e.g. it finished before our first check)
            finish();
            return;
          }
        }
      } catch {
        // transient network error — keep polling
      }
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        clearInterval(tipTimer);
        setFailed(true);
      }
    }, 4000);

    return () => {
      clearInterval(poll);
      clearInterval(tipTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <div className="py-10">
        <div className="mb-4">
          <span className="tag text-wax border-wax">Timed out</span>
        </div>
        <h2 className="font-display font-semibold text-2xl text-ink tracking-tight mb-3">
          This is taking longer than it should.
        </h2>
        <p className="text-pencil text-sm leading-reading mb-8">
          The pipeline may still be running in the background. Reload the page
          in a minute — your digest will appear once it finishes.
        </p>
        <button onClick={() => router.refresh()} className="btn-secondary">
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="py-16 flex flex-col items-center text-center">
      {/* Spinner — a square, in keeping with the no-radius notebook style */}
      <div className="w-4 h-4 border-2 border-ink animate-spin mb-8" />

      <p className="font-mono text-[11px] text-pencil uppercase tracking-widest mb-3">
        Compiling your digest
      </p>

      <h2 className="font-display font-semibold text-2xl text-ink tracking-tight mb-10">
        Reading the web so you don&apos;t have to.
      </h2>

      {/* Rotating tip — keyed so each change re-triggers the fade */}
      <div className="max-w-md min-h-[3.5rem]">
        <p key={tipIndex} className="margin-note animate-tip-fade">
          — {TIPS[tipIndex]}
        </p>
      </div>

      <p className="font-mono text-[10px] text-pencil mt-10">
        Usually 60–90 seconds. The entries will appear on their own.
      </p>
    </div>
  );
}
