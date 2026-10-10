import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Upozornenie",
  description: "MounTour pomáha s plánovaním. Časy sú odhady, za bezpečnosť na túre zodpovedá každý sám.",
  path: "/upozornenie",
});

export default function DisclaimerPage() {
  return (
    <InfoPage title="Upozornenie" intro="MounTour vám pomôže výlet naplánovať. Na horách však rozhodujete vy.">
      <h2>Časy sú odhady</h2>
      <p>
        Čas cesty, chôdze aj „vyraziť najneskôr“ sú výpočty z mapových údajov a priemerného tempa. Skutočnosť závisí
        od počasia, terénu, premávky a toho, s kým idete. Nechajte si rezervu, najmä s deťmi a na jeseň, keď sa skôr
        stmieva.
      </p>

      <h2>Pred odchodom si overte</h2>
      <ul>
        <li>
          Počasie a výstrahy, napríklad na <a href="https://www.shmu.sk">SHMÚ</a>.
        </li>
        <li>
          Uzávery chodníkov. Vo Vysokých Tatrách sú vysokohorské chodníky každý rok od 1. 11. do 15. 6. zatvorené (
          <a href="https://www.tanap.sk">TANAP</a>).
        </li>
        <li>
          Lavínovú situáciu v zime na <a href="https://www.hzs.sk">hzs.sk</a>.
        </li>
        <li>Parkovanie a spoje. Údaje o parkoviskách pochádzajú z OpenStreetMap a nemusia byť aktuálne.</li>
      </ul>

      <h2>V núdzi</h2>
      <p>
        Horská záchranná služba: <a href="tel:18300">18 300</a>, tiesňová linka <a href="tel:112">112</a>.
      </p>

      <h2>Zodpovednosť</h2>
      <p>
        Údaje poskytujeme v dobrej viere, no bez záruky úplnosti a správnosti. Za rozhodnutie vyraziť a za bezpečnosť
        na túre zodpovedá každý sám. Ak nájdete chybu, dajte nám vedieť, opravíme ju.
      </p>
    </InfoPage>
  );
}
