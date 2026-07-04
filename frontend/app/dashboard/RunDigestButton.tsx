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
        <p className="font-mono text-xs text-wax mb-2">
          Something went wrong. Make sure your profile is saved and the backend
          is running, then try again.
        </p>
        <button onClick={() => setState("idle")} className="btn-secondary text-sm">
          Try again
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
      {state === "loading" ? "Starting..." : "Generate my digest now"}
    </button>
  );
}
