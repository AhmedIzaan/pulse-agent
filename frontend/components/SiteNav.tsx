import Link from "next/link";

type Page = "operations" | "archive" | "configuration";

const LINKS: { key: Page; label: string; href: string }[] = [
  { key: "operations", label: "Operations", href: "/dashboard" },
  { key: "archive", label: "Archive", href: "/history" },
  { key: "configuration", label: "Configuration", href: "/onboarding" },
];

export default function SiteNav({ current }: { current: Page }) {
  return (
    <nav className="flex items-center gap-6 mb-8">
      {LINKS.map((link) =>
        link.key === current ? (
          <span
            key={link.key}
            className="font-mono text-sm uppercase tracking-widest text-amber border-b border-amber pb-[2px]"
          >
            {link.label}
          </span>
        ) : (
          <Link
            key={link.key}
            href={link.href}
            className="font-mono text-sm uppercase tracking-widest text-muted hover:text-amber transition-colors pb-[2px]"
          >
            {link.label}
          </Link>
        )
      )}
    </nav>
  );
}
