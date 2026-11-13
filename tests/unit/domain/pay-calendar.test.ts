/**
 * Spec 006 · A quincena starts on the day the money that funds it arrives: the configured payday,
 * moved to the previous Friday on weekends, or the date of a salary income within ±7 days.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays } from "@/domain/dates";
import {
  buildPayCalendar,
  daysUntilNextPayday,
  periodOfDate,
  toPrevFridayIfWeekend,
  withRange,
} from "@/domain/pay-calendar";
import { nextPeriod, periodFromKey } from "@/domain/periods";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { Income, IsoDate, PeriodKey } from "@/domain/types";
import { d, makeIncome } from "../../utils/fixtures";

const cal = (incomes: Income[] = [], first = 15, second = 31) =>
  buildPayCalendar({ ...DEFAULT_USER_SETTINGS, firstPayday: first, secondPayday: second }, incomes);
const range = (date: string, c = cal()) => {
  const p = periodOfDate(d(date), c);
  return [p.key, p.from, p.to];
};

describe("toPrevFridayIfWeekend", () => {
  it("moves Saturday and Sunday to Friday and leaves weekdays alone", () => {
    expect(toPrevFridayIfWeekend(d("2026-10-31"))).toBe("2026-10-30"); // Sat
    expect(toPrevFridayIfWeekend(d("2026-11-15"))).toBe("2026-11-13"); // Sun
    expect(toPrevFridayIfWeekend(d("2026-11-30"))).toBe("2026-11-30"); // Mon
    expect(toPrevFridayIfWeekend(d("2026-11-13"))).toBe("2026-11-13"); // Fri
  });
});

describe("periodOfDate (default paydays 15 and last day)", () => {
  it("Fri Nov 13 2026 (Nov 15 is Sunday) already belongs to the second half of November", () => {
    expect(range("2026-11-13")).toEqual(["2026-11-2", "2026-11-13", "2026-11-29"]);
    expect(range("2026-11-29")).toEqual(["2026-11-2", "2026-11-13", "2026-11-29"]);
  });

  it("Oct 31 2026 is Saturday: Oct 30 opens the first half of November", () => {
    expect(range("2026-10-30")).toEqual(["2026-11-1", "2026-10-30", "2026-11-12"]);
    expect(range("2026-10-31")[0]).toBe("2026-11-1");
    expect(range("2026-11-12")[0]).toBe("2026-11-1");
    expect(range("2026-10-29")[0]).toBe("2026-10-2");
  });

  it("a weekday payday starts the quincena on that same day", () => {
    expect(range("2026-12-15")).toEqual(["2026-12-2", "2026-12-15", "2026-12-30"]);
    expect(range("2026-12-14")[0]).toBe("2026-12-1");
  });

  it("clamps day 31 in short months", () => {
    // Feb 28 2026 is Saturday → Fri Feb 27; Apr 30 2026 is Thursday.
    expect(range("2026-02-27")).toEqual(["2026-03-1", "2026-02-27", "2026-03-12"]);
    expect(range("2026-04-30")[0]).toBe("2026-05-1");
    expect(range("2026-04-29")[0]).toBe("2026-04-2");
  });

  it("rolls over the year: Thu Dec 31 2026 opens January 2027", () => {
    expect(range("2026-12-31")).toEqual(["2027-01-1", "2026-12-31", "2027-01-14"]);
    expect(range("2027-01-15")[0]).toBe("2027-01-2");
  });

  it("property: every date falls inside its range and ranges chain without gaps", () => {
    const c = cal();
    const dateArb = fc
      .date({
        min: new Date("2020-01-01T00:00:00Z"),
        max: new Date("2030-12-31T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((dt) => dt.toISOString().slice(0, 10) as IsoDate);
    fc.assert(
      fc.property(dateArb, (date) => {
        const p = periodOfDate(date, c);
        expect(p.from <= date && date <= p.to).toBe(true);
        expect(addDays(p.to, 1)).toBe(withRange(nextPeriod(p), c).from);
        expect(new Date(`${p.from}T00:00:00Z`).getUTCDay()).not.toBe(0);
        expect(new Date(`${p.from}T00:00:00Z`).getUTCDay()).not.toBe(6);
      }),
    );
  });
});

describe("salary income overrides", () => {
  const late = (o: Partial<Income> = {}) =>
    makeIncome({ receivedOn: d("2026-11-16"), fundedPeriodStart: d("2026-11-16"), ...o });

  it("a salary received on Mon Nov 16 starts the quincena that day", () => {
    const c = cal([late()]);
    expect(range("2026-11-16", c)).toEqual(["2026-11-2", "2026-11-16", "2026-11-29"]);
    expect(range("2026-11-15", c)).toEqual(["2026-11-1", "2026-10-30", "2026-11-15"]);
  });

  it("ignores dates more than 7 days from the expected payday", () => {
    const c = cal([late({ receivedOn: d("2026-11-21") })]); // expected Nov 13 → +8
    expect(range("2026-11-13", c)[0]).toBe("2026-11-2");
  });

  it("ignores incomes that aren't salary", () => {
    const c = cal([late({ incomeType: "extra" })]);
    expect(range("2026-11-13", c)[0]).toBe("2026-11-2");
  });

  it("uses the earliest of several salaries for the same quincena", () => {
    const c = cal([late(), late({ receivedOn: d("2026-11-14") })]);
    expect(range("2026-11-14", c)[1]).toBe("2026-11-14");
  });

  it("ignores an override that isn't strictly between the neighbours' expected starts", () => {
    // Paydays 15 and 20: Nov-2 expected Fri Nov 13; Dec-1 expected Fri Nov 20.
    const c = cal([late({ receivedOn: d("2026-11-20") })], 15, 20);
    expect(withRange(periodFromKey("2026-11-2" as PeriodKey), c).from).toBe("2026-11-13");
  });
});

describe("daysUntilNextPayday", () => {
  it("is 0 on the effective start and counts to the next one otherwise", () => {
    expect(daysUntilNextPayday(d("2026-11-13"), cal())).toBe(0);
    expect(daysUntilNextPayday(d("2026-11-14"), cal())).toBe(16); // → Mon Nov 30
    expect(daysUntilNextPayday(d("2026-11-30"), cal())).toBe(0);
    expect(daysUntilNextPayday(d("2026-11-01"), cal())).toBe(12); // → Fri Nov 13
    expect(daysUntilNextPayday(d("2026-02-27"), cal())).toBe(0); // Feb 28 2026 is Saturday
    expect(daysUntilNextPayday(d("2026-12-20"), cal())).toBe(11); // → Thu Dec 31
  });

  it("accepts the paydays in either order", () => {
    expect(daysUntilNextPayday(d("2026-11-14"), cal([], 31, 15))).toBe(16);
  });
});
