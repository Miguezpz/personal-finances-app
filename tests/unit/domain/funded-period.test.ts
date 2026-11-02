/**
 * T057 · An income funds the first quincena that starts strictly after it was received
 * (clarification 3, US1-5/6, research.md R3).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fundedPeriodFor } from "@/domain/periods";
import type { IsoDate } from "@/domain/types";

const start = (s: string) => fundedPeriodFor(s as IsoDate).start;

describe("fundedPeriodFor", () => {
  it("day 15 funds the 16th–end of the same month (US1-5)", () => {
    expect(fundedPeriodFor("2026-11-15" as IsoDate)).toEqual({
      key: "2026-11-2",
      start: "2026-11-16",
      end: "2026-11-30",
      half: 2,
    });
  });

  it("the last day of the month funds the 1st–15th of the next month (US1-6)", () => {
    expect(start("2026-01-31")).toBe("2026-02-01");
    expect(start("2026-02-28")).toBe("2026-03-01");
    expect(start("2024-02-29")).toBe("2024-03-01");
    expect(start("2026-04-30")).toBe("2026-05-01");
  });

  it("December 31st funds January 1st of the next year", () => {
    expect(fundedPeriodFor("2026-12-31" as IsoDate).key).toBe("2027-01-1");
  });

  it("an early or late payment still funds the next period start", () => {
    expect(start("2026-11-01")).toBe("2026-11-16");
    expect(start("2026-11-14")).toBe("2026-11-16");
    expect(start("2026-11-16")).toBe("2026-12-01");
    expect(start("2026-11-29")).toBe("2026-12-01");
  });

  it("property: the funded period starts strictly after the date and at most 16 days later", () => {
    const dateArb = fc
      .date({
        min: new Date("2000-01-01T00:00:00Z"),
        max: new Date("2099-12-31T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((dt) => dt.toISOString().slice(0, 10) as IsoDate);
    fc.assert(
      fc.property(dateArb, (date) => {
        const p = fundedPeriodFor(date);
        expect(p.start > date).toBe(true);
        const gap = (Date.parse(p.start) - Date.parse(date)) / 86_400_000;
        expect(gap).toBeGreaterThanOrEqual(1);
        expect(gap).toBeLessThanOrEqual(16);
        expect(["01", "16"]).toContain(p.start.slice(8));
      }),
    );
  });
});
