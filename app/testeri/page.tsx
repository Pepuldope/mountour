import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
import { FormLink } from "@/components/FormLink";
import { pageMetadata } from "@/lib/seo";
import { TESTER_FORM_URL } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Staňte sa testerom",
  description: "Pomôžte nám vyladiť MounTour. Vyskúšate ho na svojom najbližšom výlete a poviete nám, čo vám chýbalo.",
  path: "/testeri",
});

export default function TestersPage() {
  return (
    <InfoPage
      title="Staňte sa testerom"
      intro="MounTour je nový. Hľadáme ľudí, ktorí s ním naplánujú svoj najbližší výlet a povedia nám, čo fungovalo a čo nie."
    >
      <h2>Čo to obnáša</h2>
      <ul>
        <li>Naplánujete si s MounTourom jeden skutočný výlet, sami alebo s rodinou.</li>
        <li>Potom vyplníte krátky formulár (asi 3 minúty), prípadne sa s nami na 20 minút porozprávate.</li>
        <li>Testeri sa dozvedia o nových funkciách ako prví.</li>
      </ul>
      <h2>Prihlásenie</h2>
      <p>Stačí meno, kontakt a pár odpovedí o tom, ako chodíte na výlety. Údaje použijeme len na dohodnutie testovania.</p>
      <FormLink href={TESTER_FORM_URL} label="Chcem testovať" event="tester_signup_open" />
      <p className="text-xs opacity-70">
        Formulár beží v službe Google Forms. Viac v časti <Link href="/sukromie">Súkromie</Link>.
      </p>
    </InfoPage>
  );
}
