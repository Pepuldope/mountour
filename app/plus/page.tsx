import { InfoPage } from "@/components/InfoPage";
import { PlusWant } from "@/components/PlusWant";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "MounTour+",
  description: "MounTour+ pre tých, čo chodia von často: víkendový tip, strážca výletu a neobmedzené offline výlety za 9,99 € ročne.",
  path: "/plus",
});

const FEATURES = [
  {
    title: "Víkendový tip",
    text: "V piatok ráno vám pošleme tri výlety, ktoré tento víkend sedia práve vám: od vášho štartu, s deťmi aj bez, podľa počasia.",
  },
  {
    title: "Strážca výletu",
    text: "Uložený výlet strážime. Keď sa zhorší počasie, pribudne uzávera alebo by ste nestihli návrat za svetla, dáme vám vedieť.",
  },
  {
    title: "Neobmedzené offline výlety",
    text: "Uložte si do mobilu toľko výletov a máp, koľko chcete. Fungujú aj bez signálu.",
  },
];

export default function PlusPage() {
  return (
    <InfoPage
      title={
        <>
          MounTour+{" "}
          <span className="ml-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-1 align-middle text-xs font-semibold text-[var(--warn)]">
            Pripravujeme
          </span>
        </>
      }
      intro="Pre tých, čo chodia von často. Zoznam výletov, plány, parkovanie, uzávery aj posielanie partii ostávajú zadarmo navždy."
    >
      <ul className="!list-none !pl-0 flex flex-col gap-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="!mt-0 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-3">
            <p className="font-semibold">{f.title}</p>
            <p className="text-[var(--muted)]">{f.text}</p>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-xl bg-[var(--sun-soft)] p-4">
        <p className="text-center">
          <span className="text-3xl font-extrabold">9,99 €</span> <span className="font-semibold">ročne</span>
        </p>
        <p className="text-center text-[var(--muted)]">Menej ako jeden deň parkovania v Tatrách.</p>
        <PlusWant />
      </section>

      <p className="text-xs text-[var(--muted)]">
        MounTour+ zatiaľ len pripravujeme. Poradie výletov sa nedá kúpiť, ani s MounTour+.
      </p>
    </InfoPage>
  );
}
