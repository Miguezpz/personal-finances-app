/**
 * Spec 007 · Mexican bank holidays and business days (FR-008, FR-009, research.md R1).
 */
import { describe, expect, it } from "vitest";
import {
  bankHolidays,
  easterSunday,
  isBusinessDay,
  previousBusinessDay,
} from "@/domain/business-days";
import { d } from "../../utils/fixtures";

describe("easterSunday", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2029, "2029-04-01"],
    [2030, "2030-04-21"],
  ])("%i → %s", (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe("bankHolidays", () => {
  it("lists the 11 bank holidays of 2026", () => {
    expect([...bankHolidays(2026)].sort()).toEqual([
      "2026-01-01",
      "2026-02-02", // first Monday of February
      "2026-03-16", // third Monday of March
      "2026-04-02", // Holy Thursday
      "2026-04-03", // Good Friday
      "2026-05-01",
      "2026-09-16",
      "2026-11-02",
      "2026-11-16", // third Monday of November
      "2026-12-12",
      "2026-12-25",
    ]);
  });

  it("lists the 11 bank holidays of 2027", () => {
    expect([...bankHolidays(2027)].sort()).toEqual([
      "2027-01-01",
      "2027-02-01",
      "2027-03-15",
      "2027-03-25",
      "2027-03-26",
      "2027-05-01",
      "2027-09-16",
      "2027-11-02",
      "2027-11-15",
      "2027-12-12",
      "2027-12-25",
    ]);
  });

  it("is memoized per year", () => {
    expect(bankHolidays(2026)).toBe(bankHolidays(2026));
  });
});

describe("isBusinessDay", () => {
  it("is false on weekends and holidays, true otherwise", () => {
    expect(isBusinessDay(d("2026-07-04"))).toBe(false); // Saturday
    expect(isBusinessDay(d("2026-10-04"))).toBe(false); // Sunday
    expect(isBusinessDay(d("2026-12-25"))).toBe(false); // Friday, holiday
    expect(isBusinessDay(d("2026-11-03"))).toBe(true); // Tuesday
  });
});

describe("previousBusinessDay", () => {
  it("returns the date itself when it is a business day", () => {
    expect(previousBusinessDay(d("2026-11-03"))).toBe("2026-11-03");
  });

  it("moves a Saturday or Sunday back to Friday", () => {
    expect(previousBusinessDay(d("2026-07-04"))).toBe("2026-07-03");
    expect(previousBusinessDay(d("2026-10-04"))).toBe("2026-10-02");
  });

  it("skips Holy Week and the weekend together", () => {
    expect(previousBusinessDay(d("2026-04-04"))).toBe("2026-04-01");
  });

  it("moves a holiday back, crossing into the previous year when needed", () => {
    expect(previousBusinessDay(d("2026-12-25"))).toBe("2026-12-24");
    expect(previousBusinessDay(d("2027-01-01"))).toBe("2026-12-31");
  });
});
