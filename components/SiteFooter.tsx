import Link from "next/link";
import { TESTER_FORM_URL } from "@/lib/site";

const LINKS = [
  { href: "/sukromie", label: "Súkromie" },
  { href: "/upozornenie", label: "Upozornenie" },
  { href: "/zdroje", label: "Zdroje" },
];

/** Safety note, data credits and info pages, at the bottom of every page. */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-1 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
      <p>Časy sú odhad. Na horách rozhoduje počasie a vaše sily.</p>
      <p>
        Mapa a dáta:{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
          © OpenStreetMap
        </a>
        ,{" "}
        <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="underline">
          OpenFreeMap
        </a>
      </p>
      <nav aria-label="Pätička" className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="underline">
            {l.label}
          </Link>
        ))}
        <a
          href={TESTER_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="tester_signup_open"
          className="font-medium text-[var(--foreground)] underline"
        >
          Chcem testovať
        </a>
      </nav>
    </footer>
  );
}
