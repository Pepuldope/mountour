"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { UiIcon } from "@/components/UiIcon";
import type { UiIconName } from "@/lib/uiIcons";
import { track } from "@/lib/analytics";
import { LangLink, LangSwitch, useLang, useT } from "@/lib/i18n";
import { langPath } from "@/lib/lang";
import { absoluteUrl, TESTER_FORM_URL } from "@/lib/site";
import {
  AMOUNT_PICKS,
  euro,
  groupIban,
  parseAmount,
  payBySquare,
  paymeLink,
  qrModules,
  SAMPLE_IBAN,
  SAMPLE_NAME,
  SUPPORT_GOAL_EUR,
  SUPPORT_IBAN,
  SUPPORT_NAME,
  SUPPORT_NOTE,
  SUPPORT_ON,
  type Gift,
} from "@/lib/support";

/** Hosts where real money could arrive; anywhere else (previews, local builds) shows the sample account. */
const LIVE_HOSTS = ["turuj.sk", "www.turuj.sk"];

const H2 = "font-display text-2xl leading-tight font-extrabold lg:text-[2rem]";
const CARD = "rounded-2xl border border-[var(--border)] bg-[var(--card-bg)]";
const BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center font-bold";
const BTN_MAIN = `${BTN} bg-[var(--accent)] text-[var(--accent-contrast)]`;
const BTN_LINE = `${BTN} border-[1.5px] border-[var(--accent)] text-[var(--accent)]`;

/** "Podporte nás": the goal, what support pays for, a bank gift (QR / payme link / by hand), sharing, the app and other ways to help. */
export function SupportPage({ trips, towns }: { trips: number; towns: number }) {
  const t = useT();
  return (
    <main className="flex w-full flex-1 flex-col">
      <Hero />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10 lg:px-6">
        {/* Phone: one column, the gift right after the goal. Computer: story left, gift and app right. */}
        <div className="contents lg:flex lg:flex-col lg:gap-12">
          <Goal trips={trips} towns={towns} />
          <Benefits />
          <div className="order-2 lg:order-none">
            <Rewards />
          </div>
          <div className="order-3 lg:order-none">
            <Share />
          </div>
          <div className="order-5 lg:order-none">
            <OtherWays />
          </div>
          <div className="order-6 lg:order-none">
            <Faq />
          </div>
        </div>
        <aside className="contents lg:sticky lg:top-4 lg:flex lg:flex-col lg:gap-5">
          <div className="order-1 lg:order-none">
            <GiftCard />
          </div>
          <div className="order-4 lg:order-none">
            <AppCard />
          </div>
        </aside>
        <p className="font-display order-7 text-center text-2xl font-extrabold text-[var(--accent)] lg:col-span-2">
          {t("Ďakujeme. Neplánuj. Turuj.")}
        </p>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-6 lg:px-6">
        <SiteFooter />
      </div>
    </main>
  );
}

function Hero() {
  const t = useT();
  return (
    <div className="relative overflow-hidden bg-[var(--sky-night)] text-white">
      <svg
        viewBox="0 0 1440 180"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-28 w-full lg:h-44"
      >
        <path d="M0 180 L180 90 L300 130 L470 50 L640 120 L780 80 L960 140 L1120 70 L1300 120 L1440 90 L1440 180 Z" fill="#2b4c9b" />
        <path d="M0 180 L140 150 L360 172 L560 130 L760 165 L980 140 L1200 170 L1440 145 L1440 180 Z" fill="#1d3a73" />
      </svg>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4 pb-28 lg:px-6 lg:pb-40">
        <div className="flex items-center justify-between gap-3">
          <LangLink href="/" className="text-sm font-semibold text-white">
            ← {t("Všetky výlety")}
          </LangLink>
          <LangSwitch className="text-white/80" />
        </div>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-sm font-bold">{t("Podporte Túruj")}</span>
            <h1 className="font-display max-w-2xl text-[2.1rem] leading-[1.05] font-extrabold tracking-tight lg:text-[3.5rem]">
              {t("Túruj je zadarmo. Chceme, aby to tak ostalo.")}
            </h1>
            <p className="max-w-xl text-[#d6e2f2] lg:text-lg">
              {t("Robíme ho dvaja, Peter a Radoslav, po škole a cez víkendy. Nemáme reklamy a poradie výletov si nikto nekúpi.")}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#prispevok" className={`${BTN} bg-white text-[var(--sky-night)]`}>
                {t("Prispieť")}
              </a>
              <a href="#zdielat" className={`${BTN} bg-white/15 text-white`}>
                {t("Pomôcť inak")}
              </a>
            </div>
          </div>
          <GoalCard />
        </div>
      </div>
    </div>
  );
}

/** The next goal: no running total, Peter keeps the money side private (2026-10-29). */
function GoalCard() {
  const t = useT();
  const lang = useLang();
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl bg-[var(--card-bg)] p-5 text-[var(--foreground)] shadow-[var(--shadow-float)] lg:max-w-[420px]">
      <span className="w-fit rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--accent)]">
        {t("Ďalší cieľ")}
      </span>
      <h2 className="font-display text-2xl leading-tight font-extrabold lg:text-[1.75rem]">
        {t("Pri {sum} dáme Túruj do App Store", { sum: euro(SUPPORT_GOAL_EUR, lang).replace(/[,.]00/, "") })}
      </h2>
      <p className="text-[var(--muted)]">{t("Potom si ho nájdete a nainštalujete ako každú inú appku.")}</p>
      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
        <GoalPart amount={lang === "en" ? "€220" : "220 €"} text={t("Rýchlejší a bezpečnejší web na celý rok")} />
        <GoalPart amount={lang === "en" ? "+ €100" : "+ 100 €"} text={t("Ročný poplatok Apple za zverejnenie v App Store")} />
      </div>
    </div>
  );
}

function GoalPart({ amount, text }: { amount: string; text: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <b className="font-data w-[72px] shrink-0 text-xl text-[var(--accent)]">{amount}</b>
      <span>{text}</span>
    </div>
  );
}

function Goal({ trips, towns }: { trips: number; towns: number }) {
  const t = useT();
  const lang = useLang();
  const n = (x: number) => x.toLocaleString(lang === "en" ? "en-GB" : "sk-SK");
  return (
    <section className="order-0 flex flex-col gap-3 lg:order-none">
      <h2 className={H2}>{t("Náš cieľ")}</h2>
      <p className="max-w-2xl text-lg leading-snug font-semibold lg:text-[1.35rem]">
        {t("Aby si každý vedel za päť minút naplánovať výlet do prírody: kam ísť, ako sa tam dostať a kedy vyraziť, aby bol doma za svetla.")}
      </p>
      <div className="grid max-w-2xl grid-cols-3 gap-2 lg:gap-3">
        <Stat value={n(trips)} label={t("výletov")} />
        <Stat value={n(towns)} label={t("miest, odkiaľ vyraziť")} />
        <Stat value="0" label={t("reklám")} />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={`${CARD} flex flex-col gap-0.5 p-3 lg:p-4`}>
      <span className="font-data text-[1.75rem] leading-none text-[var(--accent)] lg:text-[2.5rem]">{value}</span>
      <span className="text-[13px] text-[var(--muted)] lg:text-sm">{label}</span>
    </div>
  );
}

const BENEFITS: { icon: UiIconName; title: string; text: string }[] = [
  {
    icon: "peak",
    title: "Presnejšie časy túr",
    text: "Stúpania prepočítame z leteckého skenovania terénu. Dnešné dáta merajú aj vrcholy stromov, preto niekde vychádza kopec vyšší, ako je.",
  },
  {
    icon: "train",
    title: "Vlakom a autobusom celý rok",
    text: "Nové cestovné poriadky hneď, ako vyjdú, aby ste vedeli, ako sa dostanete na štart a späť aj bez auta.",
  },
  { icon: "pin", title: "Overené trasy, parkoviská a vstupné", text: "Každý nový výlet skontrolujeme, aby ste na mieste neboli prekvapení." },
  { icon: "phone", title: "Appka, ktorá vás vedie", text: "Kde ste na trase, upozornenie, kedy sa otočiť, a mapa aj bez signálu." },
  { icon: "clock", title: "Rýchly web aj v sobotu ráno", text: "Keď nás bude používať viac ľudí naraz, zaplatíme si výkonnejší server." },
];

function Benefits() {
  const t = useT();
  return (
    <section className="order-0 flex flex-col gap-3 lg:order-none">
      <h2 className={H2}>{t("Čo z vašej podpory budete mať")}</h2>
      <p className="text-[var(--muted)]">{t("Každé euro ide do Túruja. Tu je, na čom robíme ďalej.")}</p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className={`${CARD} flex gap-3 p-4`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
              <UiIcon name={b.icon} size={22} />
            </span>
            <span className="flex flex-col gap-0.5">
              <b>{t(b.title)}</b>
              <span className="text-sm text-[var(--muted)]">{t(b.text)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Rewards() {
  const t = useT();
  const items = [
    "Ak chcete, vaše meno pridáme na stránku O nás medzi podporovateľov.",
    "Spýtame sa vás, ktoré pohorie máme pridať ako ďalšie.",
    "Nové funkcie vyskúšate medzi prvými.",
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-extrabold">{t("Ako sa vám odvďačíme")}</h2>
      <ol className="flex flex-col gap-2.5">
        {items.map((s, i) => (
          <li key={s} className="flex items-start gap-2.5">
            <span className="grid size-[26px] shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[13px] font-extrabold text-[var(--accent)]">
              {i + 1}
            </span>
            <span>{t(s)}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-[var(--muted)]">{t("Všetko, čo Túruj vie, ostáva zadarmo pre všetkých, aj pre tých, čo neprispejú.")}</p>
    </section>
  );
}

/** Real account on turuj.sk once switched on; the sample one on previews; nothing on turuj.sk while off. */
const noChange = () => () => {};

function useAccount(): { iban: string; name: string; sample: boolean } | null {
  // The server render assumes turuj.sk, so nothing about money is in the built page while it is off.
  const live = useSyncExternalStore(noChange, () => LIVE_HOSTS.includes(window.location.host), () => true);
  if (SUPPORT_ON && SUPPORT_IBAN) return { iban: SUPPORT_IBAN, name: SUPPORT_NAME, sample: false };
  return live ? null : { iban: SAMPLE_IBAN, name: SAMPLE_NAME, sample: true };
}

/** Touch screens get the bank-app button first, computers the QR download; both see the same QR and details. */
function useOnPhone(): boolean {
  return useSyncExternalStore(noChange, () => window.matchMedia("(pointer: coarse)").matches, () => false);
}

function GiftCard() {
  const t = useT();
  const lang = useLang();
  const account = useAccount();
  const phone = useOnPhone();
  const [monthly, setMonthly] = useState(false);
  const [text, setText] = useState("10");
  const [inBank, setInBank] = useState(false);

  const amount = inBank ? null : parseAmount(text);
  const ready = account !== null && (inBank || amount !== null);
  const gift: Gift | null = ready ? { amount, monthly, iban: account.iban, name: account.name } : null;
  const modules = useMemo(() => (gift ? qrModules(payBySquare(gift)) : null), [gift?.amount, gift?.monthly, gift?.iban, gift?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) {
    return (
      <section id="prispevok" className={`${CARD} flex scroll-mt-4 flex-col gap-2 border-[var(--card-edge)] p-5 shadow-[var(--shadow-card)]`}>
        <h2 className="font-display text-2xl font-extrabold">{t("Pošlite príspevok")}</h2>
        <p className="text-[var(--muted)]">{t("Príspevky spustíme už čoskoro. Zatiaľ nám pomôžete najviac, keď o nás poviete ďalej.")}</p>
      </section>
    );
  }

  const pick = (n: number) => {
    setInBank(false);
    setText(String(n));
  };
  const chip = (on: boolean) =>
    `min-h-11 rounded-full px-3.5 font-bold ${on ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[1.5px] border-[var(--border)] bg-[var(--card-bg)]"}`;
  const seg = (on: boolean) => `min-h-10 rounded-[9px] font-bold ${on ? "bg-[var(--card-bg)] shadow-sm" : "text-[var(--muted)]"}`;
  const steps = phone
    ? [
        monthly ? "Uložte si QR kód a v appke banky ho načítajte z obrázka." : "Ťuknite na „Zaplatiť v appke banky“. Otvorí sa platba s vyplnenými údajmi.",
        "Ak sa appka neotvorí, uložte si QR kód a v banke ho načítajte z obrázka.",
        monthly ? "Skontrolujte trvalý príkaz a potvrďte ho." : "Skontrolujte platbu a potvrďte ju.",
      ]
    : [
        "Otvorte appku svojej banky v mobile.",
        "Vyberte platbu cez QR kód a namierte mobil na obrazovku.",
        monthly ? "Skontrolujte trvalý príkaz a potvrďte ho." : "Skontrolujte platbu a potvrďte ju.",
      ];
  const qrButton = (
    <button type="button" disabled={!gift} onClick={() => gift && saveQr(gift, phone)} className={phone ? BTN_LINE : BTN_MAIN}>
      {phone ? t("Uložiť QR kód do galérie") : t("Stiahnuť QR kód")}
    </button>
  );

  return (
    <section
      id="prispevok"
      className={`${CARD} flex scroll-mt-4 flex-col gap-4 border-[var(--card-edge)] p-4 shadow-[var(--shadow-card)] lg:p-5`}
    >
      {account.sample && (
        <p className="rounded-xl bg-[var(--danger-bg)] px-3 py-2 text-sm font-bold text-[var(--danger)]">
          {t("Ukážka: účet ešte nie je náš. Platbu nepotvrdzujte.")}
        </p>
      )}
      <h2 className="font-display text-2xl leading-tight font-extrabold">{t("Pošlite príspevok")}</h2>
      <p className="-mt-2 text-sm text-[var(--muted)]">{t("Koľko pošlete, je len na vás. Platíte vo svojej banke, bez poplatkov.")}</p>

      <div role="group" aria-label={t("Ako často")} className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--segment-bg)] p-1">
        <button type="button" aria-pressed={!monthly} onClick={() => setMonthly(false)} className={seg(!monthly)}>
          {t("Raz")}
        </button>
        <button type="button" aria-pressed={monthly} onClick={() => setMonthly(true)} className={seg(monthly)}>
          {t("Každý mesiac")}
        </button>
      </div>

      <label className="flex flex-col gap-1.5 font-bold">
        {t("Vaša suma")}
        <span className="flex h-14 items-center gap-2 rounded-xl border-2 border-[var(--accent)] px-3.5">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={inBank ? "" : text}
            placeholder={inBank ? t("zadáte v banke") : "10"}
            onChange={(e) => {
              setInBank(false);
              setText(e.target.value);
            }}
            className="font-data min-w-0 flex-1 bg-transparent text-[1.75rem] outline-none"
          />
          <span className="font-data text-2xl text-[var(--muted)]">€</span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {AMOUNT_PICKS.map((n) => (
          <button key={n} type="button" aria-pressed={!inBank && amount === n} onClick={() => pick(n)} className={chip(!inBank && amount === n)}>
            {lang === "en" ? `€${n}` : `${n} €`}
          </button>
        ))}
        <button type="button" aria-pressed={inBank} onClick={() => setInBank(true)} className={chip(inBank)}>
          {t("Zadám v banke")}
        </button>
      </div>
      {!inBank && amount === null && <p className="-mt-2 text-sm font-semibold text-[var(--warn)]">{t("Napíšte sumu, napríklad 10.")}</p>}

      <div className="flex items-center gap-4 border-t border-[var(--border)] pt-4">
        <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-white p-2">
          {modules ? <QrSvg modules={modules} size={132} label={t("QR kód platby")} /> : <div className="size-[132px]" />}
          <span className="text-[11px] font-bold text-[#556274]">PAY by square</span>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="w-fit rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 font-bold text-[var(--accent)]">
            {inBank ? t("suma v banke") : amount !== null ? euro(amount, lang) : "–"} · {monthly ? t("každý mesiac") : t("raz")}
          </span>
          <span className="text-[var(--muted)]">{t("Suma, účet aj správa sú v kóde.")}</span>
        </div>
      </div>

      <ol className="flex flex-col gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-2.5">
            <b className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-[var(--accent-soft)] text-[13px] text-[var(--accent)]">{i + 1}</b>
            <span>{t(s)}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        {phone && !monthly && (
          <a
            href={gift ? paymeLink(gift) : undefined}
            aria-disabled={!gift}
            onClick={() => track("support_pay", { how: "bank_app" })}
            className={`${BTN_MAIN} flex-col !gap-0`}
          >
            {t("Zaplatiť v appke banky")}
            <span className="text-[13px] font-normal opacity-85">{t("Otvorí appku banky s vyplnenou platbou")}</span>
          </a>
        )}
        {qrButton}
      </div>
      {monthly && <p className="-mt-2 text-[13px] text-[var(--muted)]">{t("Banka si uloží trvalý príkaz. Zrušíte ho kedykoľvek v appke svojej banky, nám nemusíte nič písať.")}</p>}

      <div className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-[var(--border)] px-3.5 py-3 text-sm">
        <b>{t("Alebo zadajte platbu ručne")}</b>
        <CopyRow label="IBAN" value={groupIban(account.iban)} copy={account.iban} />
        <CopyRow label={t("Príjemca")} value={account.name} />
        {amount !== null && !inBank && <CopyRow label={t("Suma")} value={euro(amount, lang)} copy={amount.toFixed(2).replace(".", lang === "en" ? "." : ",")} />}
        <CopyRow label={t("Správa")} value={SUPPORT_NOTE} />
      </div>
      <p className="text-[13px] text-[var(--muted)]">{t("QR kód funguje vo všetkých slovenských bankách.")}</p>
    </section>
  );
}

function CopyRow({ label, value, copy = value }: { label: string; value: string; copy?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="w-[72px] shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 flex-1 font-semibold break-words">{value}</span>
      <button
        type="button"
        className="min-h-9 shrink-0 font-bold text-[var(--accent)]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(copy);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
            track("support_pay", { how: "copy" });
          } catch {
            // Clipboard blocked: the value is on screen to copy by hand.
          }
        }}
      >
        {done ? t("Skopírované") : t("Kopírovať")}
      </button>
    </div>
  );
}

function QrSvg({ modules, size, label, color = "#14233b" }: { modules: boolean[][]; size: number; label: string; color?: string }) {
  const n = modules.length;
  const d = modules.flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : ""))).join("");
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#ffffff" />
      <path d={d} fill={color} />
    </svg>
  );
}

/** The QR code as a PNG: the share sheet on a phone (so it can go to Photos), a download on a computer. */
async function saveQr(gift: Gift, phone: boolean) {
  track("support_pay", { how: phone ? "qr_save" : "qr_download" });
  const m = qrModules(payBySquare(gift));
  const scale = 12;
  const pad = 4;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = (m.length + pad * 2) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  m.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect((x + pad) * scale, (y + pad) * scale, scale, scale)));
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) return;
  const file = new File([blob], "turuj-platba-qr.png", { type: "image/png" });
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // Closed the sheet, or sharing failed: fall through to a plain download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Share() {
  const t = useT();
  const lang = useLang();
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const link = absoluteUrl(langPath(lang, "/"));
  const message = `${t("Pozri Túruj. Za päť minút ti naplánuje výlet do prírody aj s tým, kedy vyraziť.")} ${link}`;
  const copy = async (what: "text" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "text" ? message : link);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
      track("support_share", { how: `copy_${what}` });
    } catch {
      // Clipboard blocked: the text is on screen.
    }
  };
  const share = async () => {
    track("support_share", { how: "sheet" });
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        return;
      }
    }
    await copy("text");
  };
  const out = "inline-flex min-h-11 items-center rounded-[10px] border-[1.5px] border-white/40 px-4 font-bold text-white";
  return (
    <section id="zdielat" className="flex scroll-mt-4 flex-col gap-3 rounded-[20px] bg-[var(--sky-night)] p-5 text-white lg:p-7">
      <h2 className={H2}>{t("Najviac pomôžete, keď o nás poviete")}</h2>
      <p className="max-w-2xl text-[#d6e2f2]">
        {t("Pošlite Túruj partii, rodine alebo do skupiny, kde plánujete výlety. Nestojí to nič a každý nový človek nám pomôže zlepšiť časy aj trasy.")}
      </p>
      <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-[#d6e2f2]">„{message}“</p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={share} className={`${BTN} bg-white text-[var(--sky-night)]`}>
          {copied === "text" ? t("Skopírované") : t("Zdieľať Túruj")}
        </button>
        <a className={out} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener" onClick={() => track("support_share", { how: "whatsapp" })}>
          WhatsApp
        </a>
        <a className={out} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener" onClick={() => track("support_share", { how: "facebook" })}>
          Facebook
        </a>
        <a className={out} href={`mailto:?subject=${encodeURIComponent("Túruj")}&body=${encodeURIComponent(message)}`} onClick={() => track("support_share", { how: "email" })}>
          {t("E-mail")}
        </a>
        <button type="button" onClick={() => copy("link")} className={out}>
          {copied === "link" ? t("Skopírované") : t("Skopírovať odkaz")}
        </button>
      </div>
    </section>
  );
}

function AppCard() {
  const t = useT();
  const lang = useLang();
  const modules = useMemo(() => qrModules(absoluteUrl(langPath(lang, "/aplikacia"))), [lang]);
  return (
    <section className={`${CARD} flex items-center gap-4 border-[var(--card-edge)] p-5`}>
      {/* On a computer the app is installed on the phone, so a code to open the page there. */}
      <span className="hidden shrink-0 rounded-[10px] border border-[var(--border)] bg-white p-1 lg:block">
        <QrSvg modules={modules} size={96} label={t("QR kód na stránku Získať appku")} color="#1769d1" />
      </span>
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] lg:hidden">
        <UiIcon name="phone" size={24} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl leading-tight font-extrabold">{t("Ešte nemáte appku?")}</h2>
        <p className="text-sm text-[var(--muted)]">
          <span className="hidden lg:inline">{t("Naskenujte kód mobilom a pridajte si Túruj na plochu.")} </span>
          {t("Otvorí sa hneď a uložené výlety máte aj bez signálu.")}
        </p>
        <LangLink href="/aplikacia" className="w-fit font-bold text-[var(--accent)]">
          {t("Získať appku")}
        </LangLink>
      </div>
    </section>
  );
}

function OtherWays() {
  const t = useT();
  const ways: { icon: UiIconName; title: string; text: string; href: string; outside?: boolean }[] = [
    { icon: "flag", title: "Nahláste chybu", text: "Iné parkovisko, zavretý chodník, zlý čas? Opravíme to pre všetkých.", href: "/nahlasit-chybu" },
    { icon: "star", title: "Povedzte, ako to šlo", text: "Po výlete stlačte „Bol som tu“. Ostatným to pomôže vybrať.", href: "/ulozene" },
    { icon: "person", title: "Testujte s nami", text: "Novinky skúsite ako prví a poviete nám, čo nefunguje.", href: TESTER_FORM_URL, outside: true },
    { icon: "chat", title: "Ste obec alebo chata?", text: "Napíšte nám. Radi pridáme vaše výlety a správy o trasách.", href: "/napiste-nam" },
  ];
  const cls = `${CARD} flex flex-col gap-1.5 p-4 hover:border-[var(--accent)]`;
  const body = (w: (typeof ways)[number]): ReactNode => (
    <>
      <span className="text-[var(--accent)]">
        <UiIcon name={w.icon} size={22} />
      </span>
      <b>{t(w.title)}</b>
      <span className="text-[13px] text-[var(--muted)]">{t(w.text)}</span>
    </>
  );
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-extrabold lg:text-[1.65rem]">{t("Ďalšie spôsoby, ako pomôcť")}</h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {ways.map((w) =>
          w.outside ? (
            <a key={w.title} href={w.href} target="_blank" rel="noopener" className={cls} onClick={() => track("tester_signup_open", { from: "support" })}>
              {body(w)}
            </a>
          ) : (
            <LangLink key={w.title} href={w.href} className={cls}>
              {body(w)}
            </LangLink>
          )
        )}
      </div>
    </section>
  );
}

function Faq() {
  const t = useT();
  const items = [
    ["Komu posielam peniaze?", SUPPORT_NAME ? "Na účet, ktorý vidíte pri platbe. Všetko ide na Túruj." : "Doplníme, keď spustíme príspevky."],
    ["Je to bezpečné?", "Áno. QR kód len vyplní platbu v appke vašej banky. Skontrolujete ju a potvrdíte sami, ako každú inú."],
    ["Dá sa zaplatiť kartou?", "Zatiaľ len prevodom z banky, aby z príspevku nič nezobral poplatok."],
    ["Bude Túruj niekedy platený?", "Výlety, plány, parkovanie, uzávery a zdieľanie ostanú zadarmo navždy. Neskôr pribudne Túruj+ s funkciami navyše pre tých, čo chodia von často."],
  ];
  return (
    <section className="flex max-w-3xl flex-col gap-2">
      <h2 className="font-display mb-1 text-xl font-extrabold lg:text-[1.65rem]">{t("Časté otázky")}</h2>
      {items.map(([q, a]) => (
        <details key={q} className={`${CARD} px-4 py-3`}>
          <summary className="cursor-pointer font-bold">{t(q)}</summary>
          <p className="mt-2 text-sm text-[var(--muted)]">{t(a)}</p>
        </details>
      ))}
    </section>
  );
}
