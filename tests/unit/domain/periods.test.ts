import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, daysInMonth, isoDate, parseIsoDate } from "@/domain/dates";
import { InvalidDateError } from "@/domain/errors";
import {
  clampChargeDay,
  nextPeriod,
  periodFromKey,
  periodOf,
  previousPeriod,
  todayIn,
} from "@/domain/periods";
import type { IsoDate, PeriodKey } from "@/domain/types";

const d = (s: string) => s as IsoDate;
const k = (s: string) => s as PeriodKey;

describe("dates", () => {
  it("validates IsoDate strings", () => {
    expect(isoDate(2026, 2, 28)).toBe("2026-02-28");
    expect(parseIsoDate(d("2024-02-29"))).toEqual({ year: 2024, month: 2, day: 29 });
    expect(() => parseIsoDate(d("2026-02-29"))).toThrow(InvalidDateError);
    expect(() => parseIsoDate(d("2026-13-01"))).toThrow(InvalidDateError);
    expect(() => parseIsoDate(d("2026-1-01"))).toThrow(InvalidDateError);
    expect(() => isoDate(2026, 4, 31)).toThrow(InvalidDateError);
  });

  it("knows month lengths, including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays(d("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(d("2024-03-01"), -1)).toBe("2024-02-29");
    expect(daysBetween(d("2026-11-01"), d("2026-11-15"))).toBe(14);
    expect(daysBetween(d("2026-11-15"), d("2026-11-01"))).toBe(-14);
  });
});

describe("periodOf", () => {
  it("days 1–15 belong to the first half, 16–end to the second", () => {
    expect(periodOf(d("2026-11-01"))).toEqual({
      key: "2026-11-1",
      start: "2026-11-01",
      end: "2026-11-15",
      half: 1,
      from: "2026-11-01",
      to: "2026-11-15",
    });
    expect(periodOf(d("2026-11-15")).key).toBe("2026-11-1");
    expect(periodOf(d("2026-11-16"))).toEqual({
      key: "2026-11-2",
      start: "2026-11-16",
      end: "2026-11-30",
      half: 2,
      from: "2026-11-16",
      to: "2026-11-30",
    });
    expect(periodOf(d("2026-02-28")).end).toBe("2026-02-28");
    expect(periodOf(d("2024-02-29")).end).toBe("2024-02-29");
    expect(periodOf(d("2026-12-31")).end).toBe("2026-12-31");
  });

  it("round-trips through its key", () => {
    expect(periodFromKey(k("2026-11-2"))).toEqual(periodOf(d("2026-11-20")));
    expect(() => periodFromKey(k("2026-11-3"))).toThrow(InvalidDateError);
    expect(() => periodFromKey(k("2026-11"))).toThrow(InvalidDateError);
  });

  it("property: every date falls inside its period", () => {
    const dateArb = fc
      .date({
        min: new Date("2000-01-01T00:00:00Z"),
        max: new Date("2100-12-31T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((dt) => d(dt.toISOString().slice(0, 10)));
    fc.assert(
      fc.property(dateArb, (date) => {
        const p = periodOf(date);
        expect(p.start <= date && date <= p.end).toBe(true);
        expect(periodFromKey(p.key)).toEqual(p);
      }),
    );
  });
});

describe("nextPeriod / previousPeriod", () => {
  it("move within a month, across months and across years", () => {
    expect(nextPeriod(periodOf(d("2026-11-03"))).key).toBe("2026-11-2");
    expect(nextPeriod(periodOf(d("2026-11-20"))).key).toBe("2026-12-1");
    expect(nextPeriod(periodOf(d("2026-12-20"))).key).toBe("2027-01-1");
    expect(previousPeriod(periodOf(d("2027-01-05"))).key).toBe("2026-12-2");
    expect(previousPeriod(periodOf(d("2026-03-02"))).start).toBe("2026-02-16");
    expect(previousPeriod(periodOf(d("2026-03-02"))).end).toBe("2026-02-28");
  });

  it("are inverses and consecutive (no gaps, no overlaps)", () => {
    let p = periodOf(d("2023-12-16"));
    for (let i = 0; i < 60; i++) {
      const n = nextPeriod(p);
      expect(previousPeriod(n)).toEqual(p);
      expect(addDays(p.end, 1)).toBe(n.start);
      p = n;
    }
  });
});

describe("clampChargeDay (FR-009)", () => {
  it("uses the last day of the month when the day doesn't exist", () => {
    expect(clampChargeDay(2026, 2, 31)).toBe("2026-02-28");
    expect(clampChargeDay(2024, 2, 31)).toBe("2024-02-29");
    expect(clampChargeDay(2024, 2, 30)).toBe("2024-02-29");
    expect(clampChargeDay(2026, 4, 31)).toBe("2026-04-30");
    expect(clampChargeDay(2026, 1, 31)).toBe("2026-01-31");
    expect(clampChargeDay(2026, 5, 5)).toBe("2026-05-05");
  });

  it("rejects days outside 1–31", () => {
    expect(() => clampChargeDay(2026, 5, 0)).toThrow(InvalidDateError);
    expect(() => clampChargeDay(2026, 5, 32)).toThrow(InvalidDateError);
  });
});

describe("todayIn", () => {
  it("returns the business date in the user's time zone, not UTC", () => {
    // 05:30 UTC on Nov 2 is still 23:30 on Nov 1 in Mexico City (UTC−6, no DST since 2022).
    const instant = new Date("2026-11-02T05:30:00Z");
    expect(todayIn("America/Mexico_City", instant)).toBe("2026-11-01");
    expect(todayIn("UTC", instant)).toBe("2026-11-02");
    // 06:00 UTC is exactly midnight in Mexico City.
    expect(todayIn("America/Mexico_City", new Date("2026-11-02T06:00:00Z"))).toBe("2026-11-02");
    // New Year's Eve crossing.
    expect(todayIn("America/Mexico_City", new Date("2027-01-01T03:00:00Z"))).toBe("2026-12-31");
  });

  it("rejects an unknown time zone", () => {
    expect(() => todayIn("Mars/Olympus", new Date())).toThrow(RangeError);
  });
});
