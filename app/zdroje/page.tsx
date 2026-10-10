import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Zdroje a mapy",
  description: "Odkiaľ MounTour berie mapy a údaje: OpenStreetMap, OpenFreeMap, openrouteservice.",
  path: "/zdroje",
});

export default function SourcesPage() {
  return (
    <InfoPage title="Zdroje a mapy" intro="MounTour stojí na otvorených údajoch. Ďakujeme všetkým, ktorí ich tvoria.">
      <h2>OpenStreetMap</h2>
      <p>
        Trasy, parkoviská, zastávky a ďalšie miesta pochádzajú z{" "}
        <a href="https://www.openstreetmap.org/copyright">© prispievateľov OpenStreetMap</a>, dostupné pod licenciou{" "}
        <a href="https://opendatacommons.org/licenses/odbl/">Open Database License (ODbL)</a>. Chybu v mape môžete
        opraviť priamo na <a href="https://www.openstreetmap.org">openstreetmap.org</a>.
      </p>

      <h2>Mapa</h2>
      <ul>
        <li>
          Podkladová mapa: <a href="https://openfreemap.org">OpenFreeMap</a>, údaje © OpenStreetMap, zobrazené cez{" "}
          <a href="https://maplibre.org">MapLibre</a>.
        </li>
        <li>Farby turistických značiek kreslíme sami z údajov OpenStreetMap.</li>
      </ul>

      <h2>Výpočty</h2>
      <ul>
        <li>
          Čas cesty autom: <a href="https://openrouteservice.org">openrouteservice</a> (© HeiGIT), údaje ©
          OpenStreetMap.
        </li>
        <li>
          Vyhľadanie miesta štartu: <a href="https://nominatim.org">Nominatim</a>, údaje © OpenStreetMap.
        </li>
        <li>Východ a západ slnka počítame priamo v aplikácii.</li>
        <li>
          Spoje verejnej dopravy: odkaz na <a href="https://cp.sk">cp.sk</a>.
        </li>
      </ul>
    </InfoPage>
  );
}
