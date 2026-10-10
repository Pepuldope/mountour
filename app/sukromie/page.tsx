import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Súkromie",
  description: "Aké údaje MounTour používa: bez cookies, bez účtov, uložené výlety ostávajú vo vašom zariadení.",
  path: "/sukromie",
});

export default function PrivacyPage() {
  return (
    <InfoPage title="Súkromie" intro="Krátko: nepoužívame cookies, nemáme účty a nepredávame žiadne údaje. Aktualizované 10. 10. 2026.">
      <h2>Kto sme</h2>
      <p>
        MounTour je študentský projekt Petra Nemčoka a Radoslava Nemca. Pri otázkach o vašich údajoch nám napíšte{" "}
        {CONTACT_EMAIL ? (
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        ) : (
          <a href={`${REPO_URL}/issues`}>cez GitHub</a>
        )}
        .
      </p>

      <h2>Štatistika návštevnosti</h2>
      <p>
        Na počítanie návštev používame <a href="https://umami.is">Umami</a>: vidíme napríklad, koľko ľudí otvorilo
        trasu, uložilo si výlet alebo prišlo z Facebooku. Umami nepoužíva cookies, nič neukladá do vášho zariadenia
        a nezisťuje, kto ste. Vidíme len súhrnné čísla.
      </p>
      <p>
        Aby sme vedeli, koľko ľudí sa k MounTouru vracia, server si pri návšteve zapíše dátum a jednosmerný
        odtlačok (hash) vytvorený z IP adresy a typu prehliadača s náhodným kľúčom, ktorý sa mení každý mesiac. IP
        adresu neukladáme a z odtlačku sa nedá spätne zistiť, kto ste. Po skončení mesiaca kľúč aj odtlačky
        zmažeme a ostanú len súhrnné čísla (napríklad „120 ľudí, z toho 15 aspoň 4 dni“).
      </p>

      <h2>Prihláška na testovanie a spätná väzba</h2>
      <p>
        Ak sa prihlásite na testovanie (odkaz „Chcem testovať“) alebo vyplníte krátky dotazník po teste, odpovede
        zbiera Google Forms. Prihlásenie do Google účtu netreba. Meno a kontakt použijeme len na dohodnutie
        testovania a po skončení testovania ich zmažeme.
      </p>

      <h2>Vaša poloha a miesto štartu</h2>
      <p>
        Ak povolíte polohu alebo napíšete miesto štartu, použijeme ich len na výpočet cesty autom. Súradnice
        zaokrúhlime asi na 100 m a pošleme službe <a href="https://openrouteservice.org">openrouteservice</a>{" "}
        (výpočet trasy). Napísané miesto vyhľadáme cez{" "}
        <a href="https://nominatim.openstreetmap.org">Nominatim (OpenStreetMap)</a>. Polohu si neukladáme.
      </p>

      <h2>Čo ostáva len vo vašom zariadení</h2>
      <p>
        Uložené výlety, napísané miesto štartu a offline kópie máp sa ukladajú iba vo vašom prehliadači, aby
        fungovali aj bez signálu. Na server ich neposielame. Zmažete ich v Mojich výletoch alebo vymazaním údajov
        stránky v prehliadači.
      </p>

      <h2>Mapy a hosting</h2>
      <p>
        Mapové dlaždice sa načítavajú priamo z ich zdrojov (pozri <Link href="/zdroje">Zdroje</Link>), ktoré vidia vašu IP
        adresu ako pri každej webovej stránke. Stránka beží na Cloudflare, ktorý vedie bežné technické záznamy.
      </p>

      <h2>Vaše práva</h2>
      <p>
        Môžete požiadať o prístup k údajom, ich opravu alebo vymazanie. Ak máte pocit, že s údajmi nezaobchádzame
        správne, môžete sa obrátiť na <a href="https://dataprotection.gov.sk">Úrad na ochranu osobných údajov SR</a>.
      </p>
    </InfoPage>
  );
}
