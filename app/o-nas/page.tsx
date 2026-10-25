import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "O nás",
  description: "Kto robí Túruj, prečo a ako počítame časy chôdze, cesty autom a návratu za svetla.",
  path: "/o-nas",
});

export default function AboutPage() {
  return (
    <InfoPage title="O nás" intro="Túruj vám povie, kam dnes na výlet, aby ste stihli cestu, túru aj návrat za svetla.">
      <p>
        Robia ho Peter Nemčok (trasy, výpočty, web) a Radoslav Nemec (testovanie, propagácia). Začali sme ako maturitný
        projekt v roku 2026 a chceme, aby vydržal. Túruj je zadarmo a poradie výletov si nikto nemôže kúpiť.
      </p>

      <h2>Ako počítame časy</h2>
      <ul>
        <li>
          Chôdza podľa normy DIN 33466, z ktorej vychádzajú aj turistické smerovníky: 4 km/h po rovine, 300 m za hodinu
          do kopca, 500 m za hodinu z kopca, zaokrúhlené na 15 minút nahor. S deťmi rátame 1,3-krát dlhšie.
        </li>
        <li>Cesta autom po cestách z OpenStreetMap, bez zápch, až na parkovisko pri štarte.</li>
        <li>Z času západu slnka v deň výletu odpočítame túru a cestu späť a povieme, kedy najneskôr vyraziť.</li>
        <li>Uzávery chodníkov v TANAP-e podľa oficiálneho zoznamu správy parku.</li>
      </ul>
      <p>Časy sú odhad pre bežného turistu. Počasie a stav chodníka si vždy overte. Odkiaľ berieme údaje, je na stránke <Link href="/zdroje">Zdroje</Link>.</p>

      <h2>Kontakt</h2>
      <p>
        Našli ste chybu v trase alebo parkovisku?{" "}
        {CONTACT_EMAIL ? (
          <>
            Napíšte nám na <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </>
        ) : (
          <>
            Napíšte nám cez <a href={`${REPO_URL}/issues`}>GitHub</a>.
          </>
        )}
      </p>
    </InfoPage>
  );
}
