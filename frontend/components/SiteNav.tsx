import Link from "next/link";

type Page = "today" | "archive" | "profile";

const LINKS: { key: Page; label: string; href: string }[] = [
  { key: "today", label: "Today", href: "/dashboard" },
  { key: "archive", label: "Archive", href: "/history" },
  { key: "profile", label: "Profile", href: "/onboarding" },
];

export default function SiteNav({ current }: { current: Page }) {
  return (
    <nav className="flex items-center gap-6 mb-8">
      {LINKS.map((link) =>
        link.key === current ? (
          <span
            key={link.key}
            className="font-mono text-[11px] uppercase tracking-widest text-ink border-b border-ink pb-[2px]"
          >
            {link.label}
          </span>
        ) : (
          <Link
            key={link.key}
            href={link.href}
            className="font-mono text-[11px] uppercase tracking-widest text-pencil hover:text-walnut transition-colors pb-[2px]"
          >
            {link.label}
          </Link>
        )
      )}
    </nav>
  );
}
