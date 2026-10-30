import { describe, expect, it } from "vitest";
import { decode, PaymentOptions } from "bysquare/pay";
import { groupIban, parseAmount, payBySquare, paymeLink, qrModules, SAMPLE_IBAN, SUPPORT_NOTE } from "@/lib/support";

const gift = { amount: 10, monthly: false, iban: SAMPLE_IBAN, name: "Peter" };

describe("support gifts", () => {
  it("reads amounts people type", () => {
    expect(parseAmount("7")).toBe(7);
    expect(parseAmount("7,5")).toBe(7.5);
    expect(parseAmount(" 12.30 € ")).toBe(12.3);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1,234")).toBeNull();
    expect(parseAmount("20000")).toBeNull();
  });

  it("puts amount, account, name and message into the PAY by square code", () => {
    const p = decode(payBySquare(gift)).payments[0];
    expect(p.type).toBe(PaymentOptions.PaymentOrder);
    expect(p.amount).toBe(10);
    expect(p.bankAccounts[0].iban).toBe(SAMPLE_IBAN);
    expect(p.beneficiary?.name).toBe("Peter");
    // The library drops accents by default, which every bank app reads.
    expect(p.paymentNote).toBe(SUPPORT_NOTE.normalize("NFD").replace(/\p{M}/gu, ""));
  });

  it("leaves the amount out when the payer types it in the bank", () => {
    // Sent as an empty field; the library's decoder reads that back as 0.
    expect(decode(payBySquare({ ...gift, amount: null })).payments[0].amount).toBeFalsy();
  });

  it("makes a monthly gift a standing order that runs every month", () => {
    const p = decode(payBySquare({ ...gift, monthly: true }, new Date(2026, 0, 31))).payments[0];
    expect(p.type).toBe(PaymentOptions.StandingOrder);
    if (p.type !== PaymentOptions.StandingOrder) return;
    expect(p.periodicity).toBe("m");
    expect(p.day).toBe(28);
  });

  it("draws a square QR code", () => {
    const m = qrModules(payBySquare(gift));
    expect(m.length).toBeGreaterThan(20);
    expect(m.every((row) => row.length === m.length)).toBe(true);
  });

  it("builds a payme link", () => {
    const u = new URL(paymeLink(gift));
    expect(u.host).toBe("payme.sk");
    expect(u.searchParams.get("IBAN")).toBe(SAMPLE_IBAN);
    expect(u.searchParams.get("AM")).toBe("10.00");
    expect(u.searchParams.get("CN")).toBe("Peter");
    expect(new URL(paymeLink({ ...gift, amount: null })).searchParams.has("AM")).toBe(false);
  });

  it("groups an IBAN in fours", () => {
    expect(groupIban(SAMPLE_IBAN)).toBe("SK96 1100 0000 0029 1859 9669");
  });
});
