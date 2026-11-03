/**
 * T114 · Numbers, money, dates and percentages follow the active language (FR-040, US7-4).
 * es-MX writes money exactly like en-US ($1,234.56 — the Mexican convention); dates and month
 * names change.
 */
import { describe, expect, it } from "vitest";
import type { BasisPoints, Cents, IsoDate } from "@/domain/types";
import { formatDate, formatMoney, formatNumber, formatPercent, formatRate } from "@/i18n/format";

const c = (n: number) => n as Cents;
const d = (s: string) => s as IsoDate;

describe("formatMoney", () => {
  it.each(["en", "es"] as const)("%s: MXN with thousands separators and two decimals", (locale) => {
    expect(formatMoney(c(123_456), "MXN", locale)).toBe("$1,234.56");
    expect(formatMoney(c(-123_456), "MXN", locale)).toBe("-$1,234.56");
    expect(formatMoney(c(5_000), "MXN", locale, { signed: true })).toBe("+$50.00");
  });

  it.each(["en", "es"] as const)("%s: tells USD apart from MXN, and uses € for EUR", (locale) => {
    expect(formatMoney(c(123_456), "USD", locale)).toBe("$1,234.56 USD");
    expect(formatMoney(c(123_456), "EUR", locale)).toBe("€1,234.56");
  });

  it("drops cents in compact mode (chart axes)", () => {
    expect(formatMoney(c(123_400), "MXN", "en", { compact: true })).toBe("$1,234");
  });
});

describe("formatDate", () => {
  it("English month-first dates", () => {
    expect(formatDate(d("2026-11-02"), "en", "short")).toBe("Nov 2");
    expect(formatDate(d("2026-11-02"), "en")).toBe("Nov 2, 2026");
    expect(formatDate(d("2026-11-02"), "en", "long")).toBe("Monday, November 2, 2026");
  });

  it("Spanish day-first dates with Spanish month and weekday names", () => {
    expect(formatDate(d("2026-11-02"), "es", "short")).toBe("2 nov");
    expect(formatDate(d("2026-11-02"), "es")).toBe("2 nov 2026");
    expect(formatDate(d("2026-11-02"), "es", "long")).toBe("lunes, 2 de noviembre de 2026");
  });

  it("never shifts a business date across time zones", () => {
    expect(formatDate(d("2026-01-01"), "en")).toBe("Jan 1, 2026");
    expect(formatDate(d("2026-12-31"), "es")).toBe("31 dic 2026");
  });
});

describe("formatPercent and formatRate", () => {
  it.each(["en", "es"] as const)("%s: percentages from basis points", (locale) => {
    expect(formatPercent(1250 as BasisPoints, locale)).toBe("12.5%");
    expect(formatPercent(10_000 as BasisPoints, locale)).toBe("100%");
  });

  it("exchange rates with up to four decimals", () => {
    expect(formatRate(18.5974, "en")).toBe("18.5974");
    expect(formatRate(20, "es")).toBe("20.00");
  });
});

describe("formatNumber", () => {
  it("uses the same regional format as amounts (es-MX: decimal point)", () => {
    expect(formatNumber(0.6, "en")).toBe("0.6");
    expect(formatNumber(0.6, "es")).toBe("0.6");
    expect(formatNumber(1234.56, "es")).toBe("1,234.6");
  });
});
