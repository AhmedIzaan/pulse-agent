"use client";

import { useEffect, useState } from "react";

const CHANNELS = ["HACKER NEWS", "REDDIT", "ARXIV", "RSS FEEDS", "GOOGLE NEWS"];

function VerticalLabel({ text }: { text: string }) {
  return (
    <span
      className="font-mono text-[10px] text-muted uppercase tracking-[0.25em] whitespace-nowrap"
      style={{ writingMode: "vertical-rl" }}
    >
      {text}
    </span>
  );
}

function ScanTrack() {
  return (
    <div className="relative w-px h-40 bg-line">
      <span className="absolute left-1/2 -translate-x-1/2 w-[3px] h-4 bg-amber animate-scan-vertical" />
    </div>
  );
}

/**
 * Purely decorative ambient chrome for the landing page's wide side gutters.
 * Fixed, non-interactive, and hidden until there's actually room for it —
 * it never competes with content or affects layout/scroll.
 */
export default function MarginConsole() {
  const [channelIndex, setChannelIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setChannelIndex((i) => (i + 1) % CHANNELS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none select-none">
      {/* Left column */}
      <div className="hidden 2xl:flex fixed left-8 top-1/2 -translate-y-1/2 flex-col items-center gap-6 z-0">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="font-mono text-[10px] text-amber uppercase tracking-widest">Live</span>
        </div>
        <ScanTrack />
        <VerticalLabel text="Surveillance active" />
      </div>

      {/* Right column */}
      <div className="hidden 2xl:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col items-center gap-6 z-0">
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">Scanning</span>
        <div className="flex flex-col items-center gap-2 h-40 justify-center">
          <span className="w-1.5 h-1.5 bg-amber" />
          <span
            key={channelIndex}
            className="font-mono text-[10px] text-amber uppercase tracking-widest animate-field-note-fade"
            style={{ writingMode: "vertical-rl" }}
          >
            {CHANNELS[channelIndex]}
          </span>
        </div>
        <VerticalLabel text="Agents deployed" />
      </div>
    </div>
  );
}
