// Site-wide settings in one place. None of these are secrets (the repo is
// public and every value ends up in the page anyway), so they live in code.
// To change one, edit this file; each can also be overridden by an env var.

/**
 * The address search engines and link previews should treat as the real one.
 * Switch to "https://mountour.sk" once the domain points at the site.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mountour.nemcok-peter123.workers.dev"
).replace(/\/+$/, "");

export const SITE_NAME = "MounTour";

export const SITE_TITLE = "Kam dnes na výlet do hôr – plánovač jednodňových túr";

export const SITE_DESCRIPTION =
  "Jednodňové výlety do hôr a prírody na Slovensku: koľko trvá cesta, kde zaparkovať, kedy najneskôr vyraziť a stihnúť návrat za svetla.";

/**
 * Umami Cloud website ID (Umami → Settings → Websites → Edit → Website ID).
 * Empty = no analytics script is loaded.
 */
export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "da63a714-c5cf-412f-8194-a13cefc0d4f6";

/**
 * Hosts where visits are counted. Local dev and preview builds stay out of
 * the numbers. Add "mountour.sk" when the domain is live.
 */
export const COUNTED_HOSTS = [
  new URL(SITE_URL).host,
  "mountour.nemcok-peter123.workers.dev",
  "mountour.vercel.app",
  "mountour.sk",
  "www.mountour.sk",
].filter((h, i, all) => all.indexOf(h) === i);

/** Public contact for privacy requests. Empty = point people to GitHub issues. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

/** Link-preview image (1200x630) from the brand guide. */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "MounTour – kam dnes na výlet, aby ste boli späť za svetla",
};

export const REPO_URL = "https://github.com/Pepuldope/mountour";

/** Google Form for tester sign-up, linked from the footer ("Chcem testovať"). */
export const TESTER_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSernHNdz6_fbYBMZK7p41rZ7YuUmTmkDV1UTYDkOUfYe78IRg/viewform";

/** Google Form for 1-5 feedback after a test. Not on the site: Radoslav sends it after each test. */
export const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf67uP7xbucQZ9dD68iF9OvPIBz75PR0y1_OORP9LCV9SsbkA/viewform";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
