import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Zdroje a mapy",
  description: "Odkiaľ MounTour berie mapy a údaje: OpenStreetMap, OpenTopoMap, Waymarked Trails, openrouteservice.",
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

      <h2>Mapové podklady</h2>
      <ul>
        <li>
          Turistická mapa: <a href="https://opentopomap.org">© OpenTopoMap</a> (
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>), údaje © OpenStreetMap, SRTM.
        </li>
        <li>
          Značené turistické trasy: <a href="https://hiking.waymarkedtrails.org">© Waymarked Trails</a>.
        </li>
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
