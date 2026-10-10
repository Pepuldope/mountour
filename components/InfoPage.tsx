import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

/** Plain text page (privacy, disclaimer, sources). */
export function InfoPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-semibold text-[var(--accent)]">
        ← Kam dnes
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.65rem] leading-tight font-extrabold">{title}</h1>
        {intro && <p className="text-sm text-[var(--muted)]">{intro}</p>}
      </header>
      <div className="flex flex-col gap-4 text-sm leading-relaxed [&_a]:text-[var(--accent)] [&_a]:underline [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
      <SiteFooter />
    </main>
  );
}
