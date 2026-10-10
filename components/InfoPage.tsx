import Link from "next/link";
import type { ReactNode } from "react";

/** Plain text page (privacy, disclaimer, sources, testers). */
export function InfoPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/" className="w-fit text-sm font-medium text-[var(--accent)] underline">
        Späť na zoznam trás
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[var(--accent)]">{title}</h1>
        {intro && <p className="text-sm opacity-80">{intro}</p>}
      </header>
      <div className="flex flex-col gap-4 text-sm leading-relaxed [&_a]:text-[var(--accent)] [&_a]:underline [&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </main>
  );
}
