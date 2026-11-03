/**
 * T104 · Currency conversion for DISPLAY only (US6, FR-032…036, research.md R11). Amounts are
 * stored in MXN; convert() never changes data, it only produces what <Money> shows.
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { convert, isPlausibleRate } from "@/domain/fx";
import type { FxSnapshot, IsoDate } from "@/domain/types";

const fx = (usd: number, eur: number): FxSnapshot => ({
  base: "MXN",
  rates: { USD: usd, EUR: eur },
  asOf: "2026-11-02" as IsoDate,
  fetchedAt: "2026-11-02T12:00:00.000Z",
  source: "test",
  stale: false,
});

describe("convert", () => {
  it("$100,000 MXN at 17.00 MXN/USD shows $5,882.35 USD (rounded half-up)", () => {
    expect(convert(cents(10_000_000), "USD", fx(1 / 17, 0.05))).toBe(588_235);
  });

  it("uses the EUR rate for EUR", () => {
    expect(convert(cents(10_000_000), "EUR", fx(0.05, 0.047628))).toBe(476_280);
  });

  it("returns the same amount for MXN, and MXN when there is no rate", () => {
    expect(convert(cents(123_456), "MXN", fx(0.05, 0.04))).toBe(123_456);
    expect(convert(cents(123_456), "USD", null)).toBe(123_456);
  });

  it("rounds exact halves away from zero, for negative balances too", () => {
    // 1 cent at 0.5 → 0.5 cent → 1; −1 cent → −1 (not −0).
    expect(convert(cents(1), "USD", fx(0.5, 0.5))).toBe(1);
    expect(convert(cents(-1), "USD", fx(0.5, 0.5))).toBe(-1);
    expect(convert(cents(-10_000_000), "USD", fx(1 / 17, 0.05))).toBe(-588_235);
    expect(Object.is(convert(cents(0), "USD", fx(0.5, 0.5)), 0)).toBe(true);
  });

  it("is exact for very large amounts (no floating-point drift in the product)", () => {
    // 9e13 cents × 0.05342 = 4.8078e12 exactly.
    expect(convert(cents(90_000_000_000_000), "USD", fx(0.05342, 0.047628))).toBe(
      4_807_800_000_000,
    );
  });

  it("never mutates its input (MXN stays the source of truth, SC-008)", () => {
    const snapshot = fx(0.05342, 0.047628);
    const before = structuredClone(snapshot);
    convert(cents(500), "USD", snapshot);
    expect(snapshot).toEqual(before);
  });
});

describe("isPlausibleRate", () => {
  const prev = { USD: 0.0534, EUR: 0.0476 };

  it("accepts positive, finite rates within 20% of the previous ones", () => {
    expect(isPlausibleRate({ USD: 0.0534, EUR: 0.0476 }, null)).toBe(true);
    expect(isPlausibleRate({ USD: 0.06, EUR: 0.05 }, prev)).toBe(true); // +12%, +5%
  });

  it("rejects zero, negative and non-finite rates", () => {
    expect(isPlausibleRate({ USD: 0, EUR: 0.0476 }, null)).toBe(false);
    expect(isPlausibleRate({ USD: -0.05, EUR: 0.0476 }, null)).toBe(false);
    expect(isPlausibleRate({ USD: Number.NaN, EUR: 0.0476 }, null)).toBe(false);
    expect(isPlausibleRate({ USD: Number.POSITIVE_INFINITY, EUR: 0.0476 }, null)).toBe(false);
  });

  it("rejects a jump bigger than 20% in either currency", () => {
    expect(isPlausibleRate({ USD: 0.0534 * 1.21, EUR: 0.0476 }, prev)).toBe(false);
    expect(isPlausibleRate({ USD: 0.0534, EUR: 0.0476 * 0.79 }, prev)).toBe(false);
  });

  it("honours a custom maximum deviation", () => {
    expect(isPlausibleRate({ USD: 0.0534 * 1.06, EUR: 0.0476 }, prev, 0.05)).toBe(false);
  });
});
