/**
 * T057 / spec 006 · An income funds the quincena whose expected payday (moved to Friday on
 * weekends) is closest to the date it was received; ties go to the later one (research.md R7).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { daysBetween } from "@/domain/dates";
import { expectedStart, fundedPeriodFor } from "@/domain/pay-calendar";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { IsoDate } from "@/domain/types";

const settings = DEFAULT_USER_SETTINGS;
const start = (s: string) => fundedPeriodFor(s as IsoDate, settings).start;

describe("fundedPeriodFor", () => {
  it("day 15 funds the 16th–end of the same month (US1-5)", () => {
    expect(fundedPeriodFor("2026-12-15" as IsoDate, settings).key).toBe("2026-12-2");
    expect(start("2026-11-15")).toBe("2026-11-16");
  });

  it("the last day of the month funds the 1st–15th of the next month (US1-6)", () => {
    expect(start("2026-01-31")).toBe("2026-02-01");
    expect(start("2026-02-28")).toBe("2026-03-01");
    expect(start("2024-02-29")).toBe("2024-03-01");
    expect(start("2026-04-30")).toBe("2026-05-01");
  });

  it("December 31st funds January 1st of the next year", () => {
    expect(fundedPeriodFor("2026-12-31" as IsoDate, settings).key).toBe("2027-01-1");
  });

  it("a payday moved to Friday funds the quincena of that payday", () => {
    expect(start("2026-11-13")).toBe("2026-11-16"); // Nov 15 is Sunday
    expect(start("2026-10-30")).toBe("2026-11-01"); // Oct 31 is Saturday
  });

  it("a late payment still funds the quincena of the closest expected payday", () => {
    expect(start("2026-11-16")).toBe("2026-11-16");
    expect(start("2026-11-18")).toBe("2026-11-16");
    expect(start("2026-11-03")).toBe("2026-11-01");
    expect(start("2026-11-29")).toBe("2026-12-01");
  });

  it("property: no other quincena has an expected payday closer to the date", () => {
    const dateArb = fc
      .date({
        min: new Date("2000-01-01T00:00:00Z"),
        max: new Date("2099-12-31T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((dt) => dt.toISOString().slice(0, 10) as IsoDate);
    fc.assert(
      fc.property(dateArb, (date) => {
        const p = fundedPeriodFor(date, settings);
        expect(["01", "16"]).toContain(p.start.slice(8));
        expect(Math.abs(daysBetween(date, expectedStart(p, settings)))).toBeLessThanOrEqual(9);
      }),
    );
  });
});
