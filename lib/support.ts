// "Podporte nás" (/podporte-nas): gifts by bank transfer, filled in by a PAY by square QR code
// (the Slovak banks' QR standard) or a payme.sk link. No payment provider, so no fees and no card data.
// Peter, 2026-10-29: money stays OFF until he has asked the school teacher on 11 Nov whose account
// receives it. Until then the page is unlinked, kept out of search, and shows the gift card only on
// previews and local builds, with a sample account.

import { CurrencyCode, encode, PaymentOptions, Periodicity } from "bysquare/pay";
import { encode as qrMatrix } from "uqr";

export { SUPPORT_ON } from "@/lib/site";

/** The receiving account and its holder's name, set when money goes on. */
export const SUPPORT_IBAN = (process.env.NEXT_PUBLIC_SUPPORT_IBAN ?? "").replace(/\s+/g, "").toUpperCase();
export const SUPPORT_NAME = process.env.NEXT_PUBLIC_SUPPORT_NAME ?? "";

/** The library's documentation example, shown on previews with a "do not send" banner. */
export const SAMPLE_IBAN = "SK9611000000002918599669";
export const SAMPLE_NAME = "Ukážkový príjemca";

/** What the payer sees as the message for the recipient. */
export const SUPPORT_NOTE = "Dar pre Túruj";

/** The next goal (Peter, 2026-10-29): a year of Cloudflare Pro (about 220 €) plus Apple's 100 € fee, then the App Store. */
export const SUPPORT_GOAL_EUR = 320;

/** Quick picks next to the free amount field. */
export const AMOUNT_PICKS = [5, 10, 20, 50];

const MAX_AMOUNT = 10000;

export interface Gift {
  /** null = the payer types the amount in the bank app. */
  amount: number | null;
  monthly: boolean;
  iban: string;
  name: string;
}

/** "7", "7,5" or "7.50 €" to 7.5; null when empty, not a number, not positive or absurdly large. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/€|\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 && n <= MAX_AMOUNT ? Math.round(n * 100) / 100 : null;
}

/** 10 to "10,00 €" (Slovak) or "€10.00" (English). */
export function euro(amount: number, lang: "sk" | "en"): string {
  return lang === "en" ? `€${amount.toFixed(2)}` : `${amount.toFixed(2).replace(".", ",")} €`;
}

/** "SK9611000000002918599669" to "SK96 1100 0000 0029 1859 9669". */
export function groupIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ");
}

/**
 * The PAY by square text a bank app reads from the QR code. A monthly gift becomes a standing order
 * from today's day of the month (at most the 28th, so it runs in February too).
 */
export function payBySquare(gift: Gift, today = new Date()): string {
  const base = {
    currencyCode: CurrencyCode.EUR,
    ...(gift.amount !== null ? { amount: gift.amount } : {}),
    paymentNote: SUPPORT_NOTE,
    beneficiary: { name: gift.name },
    bankAccounts: [{ iban: gift.iban }],
  };
  return encode({
    payments: [
      gift.monthly
        ? { ...base, type: PaymentOptions.StandingOrder, periodicity: Periodicity.Monthly, day: Math.min(today.getDate(), 28) }
        : { ...base, type: PaymentOptions.PaymentOrder },
    ],
  });
}

/** QR modules (true = dark) for the payment text. */
export function qrModules(text: string): boolean[][] {
  return qrMatrix(text, { ecc: "M", border: 0 }).data;
}

/**
 * A payme.sk link (the Slovak banks' payment link standard). It opens the payment in the bank app
 * where the bank supports it, and otherwise shows a QR page. One-off payments only.
 */
export function paymeLink(gift: Gift): string {
  const p = new URLSearchParams({ V: "1", IBAN: gift.iban });
  if (gift.amount !== null) p.set("AM", gift.amount.toFixed(2));
  p.set("CC", "EUR");
  p.set("MSG", SUPPORT_NOTE);
  p.set("CN", gift.name);
  return `https://payme.sk/?${p.toString()}`;
}
