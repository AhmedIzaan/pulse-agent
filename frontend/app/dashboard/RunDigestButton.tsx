"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunDigestButton() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function handleRun() {
    setState("loading");
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/pipeline/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      // Hand off to the compiling view, which polls until the run finishes
      router.replace("/dashboard?generating=1");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "error") {
    return (
      <div className="mt-6">
        <p className="font-mono text-xs uppercase tracking-widest text-urgent mb-2">
          Signal lost
        </p>
        <p className="text-ink text-base leading-reading mb-3">
          Could not reach the agents. Make sure your configuration is saved and try again.
        </p>
        <button onClick={() => setState("idle")} className="btn-ghost">
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleRun}
      disabled={state === "loading"}
      className="btn-primary mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {state === "loading" ? "Deploying..." : "Run agents now"}
    </button>
  );
}
