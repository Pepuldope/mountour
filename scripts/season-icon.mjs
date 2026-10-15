// Puts the current season's icon in place before `next build`
// (npm runs it as "prebuild"). The drawings live in public/icons/season/<season>/
// (made by scripts/build_icons.py); the site rebuilds at least weekly with the
// trip data, so the icon follows the season like the headers do.
// Seasons match seasonOf() in lib/season.ts.
import { copyFileSync } from "node:fs";

const m = new Date().getMonth() + 1;
const season = m === 12 || m <= 2 ? "zima" : m <= 5 ? "jar" : m <= 8 ? "leto" : "jesen";
const from = `public/icons/season/${season}`;

const copies = {
  "icon.svg": ["app/icon.svg", "public/icons/icon.svg"],
  "apple-icon.png": ["app/apple-icon.png"],
  "icon-192.png": ["public/icons/icon-192.png"],
  "icon-512.png": ["public/icons/icon-512.png"],
};
for (const [file, targets] of Object.entries(copies)) for (const to of targets) copyFileSync(`${from}/${file}`, to);
console.log(`Site icon: ${season}`);
