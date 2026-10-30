import { InfoPage } from "@/components/InfoPage";
import { LangLink } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";
import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy",
  description: "What data Túruj uses: an account only if you want one, no advertising cookies, saved trips stay on your device.",
  path: "/sukromie",
  lang: "en",
});

// The Slovak page (app/sukromie) is the one that counts; this is its translation.
export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy" intro="In short: an account only if you want one, a cookie only for signing in, and we sell no data. Updated 30 October 2026.">
      <h2>Who we are</h2>
      <p>
        Túruj is a student project by Peter Nemčok and Radoslav Nemec. For questions about your data, write to us{" "}
        {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <a href={`${REPO_URL}/issues`}>on GitHub</a>}.
      </p>

      <h2>Visit statistics</h2>
      <p>
        We count visits with <a href="https://umami.is">Umami</a> (Umami Cloud): we see, for example, how many people
        opened a route, saved a trip or came from Facebook. Umami uses no cookies, stores nothing on your device and
        does not find out who you are. Its server sees your IP address, as with any website. We only see totals.
      </p>
      <p>
        To know how many people come back to Túruj, the server writes down the date of a visit and a one-way
        fingerprint (hash) made from the IP address and the browser type with a random key that changes every month. We
        do not store the IP address. Without the key the fingerprint says nothing, and when the month ends we delete the
        key and the fingerprints, leaving only totals (for example &ldquo;120 people, 15 of them on at least 4 days&rdquo;).
      </p>
      <p>
        For a few steps (entering a start, saving or sending a plan, opening a plan from a friend, navigation) the
        server also adds one to a monthly total, and for a plan whether it happened within 2 minutes of arriving.
        Nothing about you or the place is stored.
      </p>

      <h2>Account and sign-in</h2>
      <p>
        An account is optional. We store your email, your name if you give one (with Google, the one Google sends us,
        and the Google account number), and when you last signed in. We never store your password in readable form,
        only a salted fingerprint of it (PBKDF2) that the password can't be worked out from. The email code is sent through the Resend service and deleted once used or after 15 minutes. Your
        browser keeps the sign-in in one cookie (turuj_s) for at most 180 days; we store only a fingerprint of it. It
        is set only after you sign in and is not used for advertising. We delete the account and all its data on request.
      </p>

      <h2>Trip reviews</h2>
      <p>
        When you send a short review after a trip (stars, whether the route matched the description, whether the
        plan&apos;s times were right and whether it was crowded), we store it in our database together with the trip&apos;s
        name, the date and a random number kept by your browser, so that a second review of the same trip replaces the
        first. We do not store your name, e-mail or IP address. The trip page shows only totals.
      </p>

      <h2>Messages via Write to us and Report a problem</h2>
      <p>
        What you write is stored in our database on Cloudflare, with the date and the trip it is about. We store your
        email only if you fill it in, and use it only to reply. We store no IP address and nothing else about you. We
        delete a message on request.
      </p>

      <h2>Tester sign-up and feedback</h2>
      <p>
        If you sign up for testing (the &ldquo;I want to test&rdquo; link) or fill in the short questionnaire after a
        test, the answers are collected by Google Forms. You don&apos;t need to sign in to a Google account. We use your
        name and contact only to arrange the testing and delete them when testing ends.
      </p>

      <h2>Your location and starting place</h2>
      <p>
        If you allow location or type in a starting place, we use them only to work out the drive. We round the
        coordinates to about 100 m and send them to <a href="https://openrouteservice.org">openrouteservice</a> (route
        calculation). We look up a typed place with{" "}
        <a href="https://nominatim.openstreetmap.org">Nominatim (OpenStreetMap)</a>. With location allowed we also send
        Nominatim the rounded coordinates (about 100 m) to find the name of the town. We do not store your location.
      </p>

      <h2>What stays only on your device</h2>
      <p>
        Saved trips, a typed starting place and offline copies of maps are stored only in your browser, so they work
        without signal too. We do not send them to the server. You can delete them in My trips or by clearing the
        site&apos;s data in your browser.
      </p>

      <h2>Maps and hosting</h2>
      <p>
        Map tiles load directly from their sources (see <LangLink href="/zdroje">Sources</LangLink>) and photos on town
        pages from Wikimedia Commons. These servers see your IP address as with any website; we load photos without
        cookies and without the address of the page you come from. The site runs on Cloudflare, which keeps the usual
        technical logs.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for access to your data, for it to be corrected or deleted. If you feel we are not handling data
        properly, you can turn to the{" "}
        <a href="https://dataprotection.gov.sk">Office for Personal Data Protection of the Slovak Republic</a>.
      </p>
    </InfoPage>
  );
}
