/** Safety note and data credits, at the bottom of every page. */
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
    </footer>
  );
}
