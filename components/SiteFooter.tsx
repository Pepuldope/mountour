import Link from "next/link";

const LINKS = [
  { href: "/testeri", label: "Chcem testovať" },
  { href: "/sukromie", label: "Súkromie" },
  { href: "/upozornenie", label: "Upozornenie" },
  { href: "/zdroje", label: "Zdroje a mapy © OpenStreetMap" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] px-4 py-4 text-xs opacity-80">
      <nav aria-label="Pätička" className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="underline">
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
