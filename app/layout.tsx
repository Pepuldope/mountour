import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { UserLocationProvider } from "@/lib/userLocation";
import { TripSettingsProvider } from "@/lib/tripSettings";

// Brand fonts (strategy/06-identity): latin-ext covers every Slovak letter.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "MounTour",
  description:
    "Naplánuj si jednodňový výlet do hôr - kedy vyraziť, kde parkovať a kedy sa vrátiť pred západom slnka.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17213a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sk"
      className={`${figtree.variable} ${bricolage.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <UserLocationProvider>
          <TripSettingsProvider>{children}</TripSettingsProvider>
        </UserLocationProvider>
      </body>
    </html>
  );
}
