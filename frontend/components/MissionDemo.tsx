"use client";

import { useEffect, useState } from "react";

const INTEREST_TEXT = "machine learning research and indie game dev";

const STEPS = [
  {
    step: "01",
    title: "Describe your interests",
    body: "Open the Configuration tab and type what you follow. Plain English — no dropdowns, no categories.",
  },
  {
    step: "02",
    title: "Your agents deploy",
    body: "Hit Deploy and watch them work on the Operations page — sources mapped, filters calibrated.",
  },
  {
    step: "03",
    title: "Your brief arrives",
    body: "It lands on Operations every morning (and in your inbox, if you want). Past briefs live in the Archive tab.",
  },
];

// The app's real tabs — the demo highlights where each phase happens
const TABS = ["Operations", "Archive", "Configuration"] as const;

// Timeline (1 tick = 120ms). Total loop ≈ 14s.
const T_AGENTS = 34; // typing + pause ends
const T_BRIEF = 78; // agent log ends
const T_RESET = 115;

function blocks(filled: number) {
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

export default function MissionDemo() {
  const [tick, setTick] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No animation: freeze on the completed state
      setReduced(true);
      setTick(T_BRIEF + 10);
      return;
    }
    const timer = setInterval(() => {
      setTick((t) => (t >= T_RESET ? 0 : t + 1));
    }, 120);
    return () => clearInterval(timer);
  }, []);

  const typedChars = Math.min(INTEREST_TEXT.length, tick * 2);
  const crawlerBlocks = Math.max(0, Math.min(10, Math.floor((tick - T_AGENTS) / 1.5)));
  const showFilter = tick >= T_AGENTS + 20;
  const showAnalyst = tick >= T_AGENTS + 28;
  const showCourier = tick >= T_AGENTS + 36;
  const showEntry = tick >= T_BRIEF;

  const activeStep = tick < T_AGENTS ? 0 : tick < T_BRIEF ? 1 : 2;
  // Phase 1 happens on Configuration; deploying and the delivered brief
  // both live on Operations — exactly like the real app
  const activeTab: (typeof TABS)[number] =
    activeStep === 0 ? "Configuration" : "Operations";

  return (
    <div>
      {/* Console panel */}
      <div className="bg-surface border border-line mb-8">
        {/* Title strip */}
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            Live demonstration
          </span>
          <span className="flex items-center gap-2">
            <span className="pulse-dot" />
            <span className="font-mono text-xs uppercase tracking-widest text-amber">
              {activeStep === 0 ? "Configuring" : activeStep === 1 ? "Agents deployed" : "Brief filed"}
            </span>
          </span>
        </div>

        {/* Mini tab bar — mirrors the app's real navigation so users see
            which page each phase happens on */}
        <div className="flex items-center gap-5 border-b border-line px-4 py-2">
          {TABS.map((tab) => (
            <span
              key={tab}
              className={`font-mono text-xs uppercase tracking-widest transition-colors duration-300 pb-[1px] ${
                tab === activeTab
                  ? "text-amber border-b border-amber"
                  : "text-muted"
              }`}
            >
              {tab === activeTab ? "▸ " : ""}
              {tab}
            </span>
          ))}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted hidden sm:inline">
            You are here
          </span>
        </div>

        <div className="p-5 sm:p-6 min-h-[290px]">
          {/* Phase 1 — typing the configuration */}
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-2">
            I care about
          </p>
          <p className="font-mono text-sm text-ink mb-6">
            {INTEREST_TEXT.slice(0, typedChars)}
            {!reduced && activeStep === 0 && (
              <span className="text-amber animate-pulse">▌</span>
            )}
          </p>

          {/* Phase 2 — agent log */}
          {tick >= T_AGENTS && (
            <div className="space-y-2 font-mono text-xs sm:text-sm mb-6">
              <p className="text-ink">
                <span className="text-muted">CRAWLER</span>{" "}
                <span className="text-amber">{blocks(crawlerBlocks)}</span>{" "}
                {crawlerBlocks >= 10 ? "47 SOURCES SCANNED" : "SCANNING..."}
              </p>
              {showFilter && (
                <p className="text-ink animate-ticker-in">
                  <span className="text-muted">FILTER</span>{" "}
                  <span className="text-amber">✓</span> 312 ITEMS → 10
                </p>
              )}
              {showAnalyst && (
                <p className="text-ink animate-ticker-in">
                  <span className="text-muted">ANALYST</span>{" "}
                  <span className="text-amber">✓</span> NOTES WRITTEN
                </p>
              )}
              {showCourier && (
                <p className="text-ink animate-ticker-in">
                  <span className="text-muted">COURIER</span>{" "}
                  <span className="text-amber">✓</span> BRIEF FILED 06:47
                </p>
              )}
            </div>
          )}

          {/* Phase 3 — the brief arrives */}
          {showEntry && (
            <div className="file-entry py-1 animate-ticker-in">
              <p className="font-mono text-xs tracking-widest text-amber uppercase mb-1">
                #0001 · ARXIV
              </p>
              <p className="font-display font-bold text-lg text-ink leading-tight tracking-tight mb-1">
                Multi-agent systems show emergent planning in open-ended tasks
              </p>
              <div className="analyst-note mt-2">
                <span className="analyst-note-label">Analyst note</span>
                <p className="text-ink text-sm italic leading-snug">
                  Lands directly on the agent-coordination problem you follow.
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mt-3">
                + 9 more items · filed to Archive · searchable any time
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Steps — highlighted in sync with the demo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-6">
        {STEPS.map((item, i) => (
          <div
            key={item.step}
            className={`border-l-2 pl-4 transition-colors duration-300 ${
              i === activeStep ? "border-amber" : "border-line"
            }`}
          >
            <span
              className={`font-mono text-xs block mb-1 transition-colors duration-300 ${
                i === activeStep ? "text-amber" : "text-muted"
              }`}
            >
              {item.step}
            </span>
            <p
              className={`font-display font-semibold text-xl uppercase tracking-tight mb-1 transition-colors duration-300 ${
                i === activeStep ? "text-ink" : "text-muted"
              }`}
            >
              {item.title}
            </p>
            <p className="text-muted text-base leading-reading">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
