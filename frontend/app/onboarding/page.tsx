"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "../../components/SiteNav";

const DELIVERY_TIMES = [
  "06:00", "07:00", "08:00", "09:00", "10:00",
  "12:00", "14:00", "16:00", "18:00", "20:00",
];

const STARTER_PROFILES: { label: string; text: string }[] = [
  {
    label: "Tech",
    text: "I follow software engineering and AI closely — new developer tools, LLM releases and research, open-source projects gaining traction, systems programming, and major launches from companies like OpenAI, Anthropic, and Google DeepMind.",
  },
  {
    label: "Gaming",
    text: "I follow the games industry — new releases and reviews, indie game development, game engine news (Unreal, Unity, Godot), esports results, and business news about studios and publishers.",
  },
  {
    label: "Music",
    text: "I follow music — new album releases and reviews across genres, music production tools and techniques, the streaming industry, vinyl culture, and stories about how artists make a living today.",
  },
  {
    label: "Finance",
    text: "I follow markets and finance — macro trends, central bank policy, notable startup funding rounds and IPOs, fintech products, and long-form analysis on investing and the global economy.",
  },
  {
    label: "Literature",
    text: "I follow books and writing — notable new fiction and non-fiction releases, literary prize news, essays on the craft of writing, the publishing industry, and thoughtful long-form criticism.",
  },
];

function today() {
  return new Date()
    .toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

export default function OnboardingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [interests, setInterests] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("08:00");
  const [timezone, setTimezone] = useState("UTC");
  const [emailDigest, setEmailDigest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prefilling, setPrefilling] = useState(true);

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

    async function loadExisting() {
      try {
        const token = await getToken();
        const res = await fetch(`${apiUrl}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setInterests(data.interests);
          setDeliveryTime(data.delivery_time);
          setTimezone(data.timezone);
          setEmailDigest(Boolean(data.email_digest));
        }
      } catch {
        // no existing profile — fine, start blank
      } finally {
        setPrefilling(false);
      }
    }

    loadExisting();
  }, [getToken, apiUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!interests.trim()) return;

    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/api/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          interests,
          delivery_time: deliveryTime,
          timezone,
          email_digest: emailDigest,
          email: userEmail || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Configuration rejected. Try again.");
        return;
      }

      // Deploy agents — the backend ignores this if a run is already in
      // flight for this user, so it is safe to fire on every save.
      try {
        await fetch(`${apiUrl}/api/pipeline/run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // brief will still compile on the daily cron
      }

      router.push("/dashboard?generating=1");
    } catch {
      setError("Could not reach the agents. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const charsLeft = 2000 - interests.length;

  return (
    <div className="min-h-screen bg-opsblack font-body animate-page-fade">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Ops header */}
        <header className="flex items-baseline justify-between">
          <Link
            href="/dashboard"
            className="font-display font-black text-3xl tracking-tight text-amber uppercase hover:text-amber-dim transition-colors"
          >
            MakeDigest
          </Link>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted tracking-widest">{today()}</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <div className="mt-3 rule" />
        <div className="mt-[3px] rule mb-6" />

        <SiteNav current="configuration" />

        {/* Header */}
        <div className="mb-6">
          <span className="tag text-amber">Configuration</span>
        </div>

        <h1 className="font-display font-bold text-3xl text-parchment tracking-tight mb-2 uppercase">
          Configure your brief
        </h1>
        <p className="text-parchment text-base leading-reading mb-1">
          Tell our agents what to monitor. Describe your interests in plain
          English — they&apos;ll figure out where to look.
        </p>
        <p className="text-amber-dim text-base italic leading-reading mb-10">
          — The more specific the order, the sharper the brief.
        </p>

        {prefilling ? (
          <p className="font-mono text-xs text-muted uppercase tracking-widest">Retrieving configuration...</p>
        ) : (
          <form onSubmit={handleSubmit}>

            {/* Starter profiles */}
            <div className="mb-6">
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Deploy from template
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTER_PROFILES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setInterests(p.text)}
                    className="tag text-amber hover:bg-amber hover:text-opsblack transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div className="mb-8">
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                I care about
              </label>
              <textarea
                value={interests}
                onChange={(e) => setInterests(e.target.value.slice(0, 2000))}
                rows={8}
                placeholder="machine learning research, indie game development, Y Combinator funding rounds, multi-agent AI systems..."
                className="field-input w-full font-mono text-base leading-reading resize-none"
              />
              <div className="flex justify-end mt-1">
                <span
                  className={`font-mono text-xs ${
                    charsLeft < 100 ? "text-urgent" : "text-muted"
                  }`}
                >
                  {charsLeft} characters remaining
                </span>
              </div>
            </div>

            {/* Delivery time */}
            <div className="mb-6">
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Brief compilation time
              </label>
              <div className="relative inline-block">
                <select
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="field-input font-mono text-base pr-10 appearance-none cursor-pointer"
                >
                  {DELIVERY_TIMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
                  ▾
                </span>
              </div>
              <p className="font-mono text-xs text-muted mt-2">
                Agents compile your brief at this time each morning.
              </p>
            </div>

            {/* Timezone */}
            <div className="mb-10">
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Timezone
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="field-input font-mono text-base w-64"
              />
              <p className="font-mono text-xs text-muted mt-2">
                IANA format — e.g. America/New_York, Europe/London, Asia/Karachi
              </p>
            </div>

            {/* Email delivery */}
            <div className="mb-10">
              <p className="font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Transmission
              </p>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailDigest}
                  onChange={(e) => setEmailDigest(e.target.checked)}
                  className="field-checkbox"
                />
                <span className="text-parchment text-base leading-reading">
                  Transmit my brief by email each morning
                  {userEmail && (
                    <span className="block font-mono text-xs text-muted mt-1">
                      → {userEmail}
                    </span>
                  )}
                </span>
              </label>
              <p className="text-amber-dim text-base italic leading-reading mt-2">
                — Your brief always compiles here in Operations either way.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="font-mono text-xs uppercase tracking-widest text-urgent mb-6">{error}</p>
            )}

            {/* Submit */}
            <div className="flex items-center gap-6">
              <button
                type="submit"
                disabled={loading || !interests.trim()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Deploying agents..." : "Deploy agents"}
              </button>
              <span className="font-mono text-xs text-muted">
                Edit this configuration any time.
              </span>
            </div>

          </form>
        )}

        {/* Footer rule */}
        <div className="rule mt-16 pt-6">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">
            Agents operate continuously. Ten items. Every morning.
          </p>
        </div>

      </div>
    </div>
  );
}
