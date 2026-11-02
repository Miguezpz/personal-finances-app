/**
 * T070 · Days until the next payday (FR-019). Paydays default to the 15th and the last day of
 * the month (31 → clamped in short months); on a payday the answer is 0.
 */
import { describe, expect, it } from "vitest";
import { daysUntilNextPayday } from "@/domain/periods";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { IsoDate } from "@/domain/types";

const days = (today: string, first = 15, second = 31) =>
  daysUntilNextPayday(today as IsoDate, {
    ...DEFAULT_USER_SETTINGS,
    firstPayday: first,
    secondPayday: second,
  });

describe("daysUntilNextPayday", () => {
  it("counts to the 15th in the first half", () => {
    expect(days("2026-11-01")).toBe(14);
    expect(days("2026-11-14")).toBe(1);
  });

  it("is 0 on a payday", () => {
    expect(days("2026-11-15")).toBe(0);
    expect(days("2026-11-30")).toBe(0);
    expect(days("2026-02-28")).toBe(0); // 31 clamps to Feb 28
    expect(days("2024-02-29")).toBe(0);
  });

  it("counts to the (clamped) last day in the second half", () => {
    expect(days("2026-11-16")).toBe(14);
    expect(days("2026-02-16")).toBe(12);
    expect(days("2026-12-20")).toBe(11);
  });

  it("rolls over to the next month (and year)", () => {
    expect(days("2026-12-31")).toBe(0);
    expect(days("2026-11-30", 15, 30)).toBe(0);
    expect(days("2026-12-31", 15, 30)).toBe(15); // Dec 30 passed → Jan 15
    expect(days("2026-11-16", 1, 15)).toBe(15); // → Dec 1 (Nov has 30 days)
  });

  it("works with paydays in either order", () => {
    expect(days("2026-11-10", 31, 15)).toBe(5);
  });
});
