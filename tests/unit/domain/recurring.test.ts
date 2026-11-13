/**
 * T078 · Recurring expenses (US3, FR-007…FR-011): due occurrences since starts_on (idempotent,
 * one per month), day 31 → last day, ended_on respected, pending = this quincena's future charges,
 * and edits never touch or duplicate what was already applied.
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { buildPayCalendar, periodOfDate } from "@/domain/pay-calendar";
import { periodOf } from "@/domain/periods";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import {
  dueOccurrences,
  pendingOccurrences,
  recurringStatusForPeriod,
  retroactiveChargeCount,
} from "@/domain/recurring";
import type { Expense, RecurringExpense } from "@/domain/types";
import { d, makeExpense, makeRecurring } from "../../utils/fixtures";

const rent = makeRecurring({
  name: "Rent",
  amount: cents(800_000),
  chargeDay: 5,
  bucket: "needs",
  startsOn: d("2026-09-01"),
});

/** What the app inserts for each due occurrence (the applied history). */
const apply = (r: RecurringExpense, occurrenceDate: string, amount = r.amount): Expense =>
  makeExpense({
    amount,
    spentOn: d(occurrenceDate),
    bucket: r.bucket,
    subcategoryId: r.subcategoryId,
    origin: "recurring",
    recurringExpenseId: r.id,
    occurrenceDate: d(occurrenceDate),
  });

const dates = (xs: readonly { occurrenceDate: string }[]) => xs.map((x) => x.occurrenceDate);

describe("dueOccurrences", () => {
  it("returns every charge from starts_on up to today, with amount and bucket", () => {
    const due = dueOccurrences([rent], [], d("2026-11-10"));
    expect(dates(due)).toEqual(["2026-09-05", "2026-10-05", "2026-11-05"]);
    expect(due[0]).toEqual({
      recurringExpenseId: rent.id,
      occurrenceDate: "2026-09-05",
      amount: 800_000,
      bucket: "needs",
    });
  });

  it("includes a charge that falls exactly today, but nothing in the future", () => {
    expect(dates(dueOccurrences([rent], [], d("2026-09-05")))).toEqual(["2026-09-05"]);
    expect(dueOccurrences([rent], [], d("2026-09-04"))).toEqual([]);
  });

  it("skips charges before starts_on", () => {
    const late = { ...rent, startsOn: d("2026-09-06") };
    expect(dates(dueOccurrences([late], [], d("2026-10-31")))).toEqual(["2026-10-05"]);
  });

  it("is idempotent: with the applied history updated it returns nothing", () => {
    const today = d("2026-11-10");
    const first = dueOccurrences([rent], [], today);
    const applied = first.map((o) => apply(rent, o.occurrenceDate));
    expect(dueOccurrences([rent], applied, today)).toEqual([]);
  });

  it("catches up only what is missing after days without opening the app (US3-4)", () => {
    const applied = [apply(rent, "2026-09-05")];
    expect(dates(dueOccurrences([rent], applied, d("2026-11-30")))).toEqual([
      "2026-10-05",
      "2026-11-05",
    ]);
  });

  it("day 31 lands on the last day of short months (FR-009)", () => {
    const gym = makeRecurring({ chargeDay: 31, startsOn: d("2026-01-01") });
    expect(dates(dueOccurrences([gym], [], d("2026-04-30")))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    const leap = makeRecurring({ chargeDay: 30, startsOn: d("2024-02-01") });
    expect(dates(dueOccurrences([leap], [], d("2024-02-29")))).toEqual(["2024-02-29"]);
  });

  it("days 15 and 16 fall in a single, different quincena", () => {
    const d15 = dueOccurrences(
      [makeRecurring({ chargeDay: 15, startsOn: d("2026-11-01") })],
      [],
      d("2026-11-30"),
    );
    const d16 = dueOccurrences(
      [makeRecurring({ chargeDay: 16, startsOn: d("2026-11-01") })],
      [],
      d("2026-11-30"),
    );
    expect(periodOf(d15[0]!.occurrenceDate).key).toBe("2026-11-1");
    expect(periodOf(d16[0]!.occurrenceDate).key).toBe("2026-11-2");
  });

  it("respects ended_on (paused/ended) inclusively, and generates nothing after it (US3-6)", () => {
    const paused = { ...rent, endedOn: d("2026-10-05") };
    expect(dates(dueOccurrences([paused], [], d("2026-12-31")))).toEqual([
      "2026-09-05",
      "2026-10-05",
    ]);
    const pausedBefore = { ...rent, endedOn: d("2026-10-04") };
    expect(dates(dueOccurrences([pausedBefore], [], d("2026-12-31")))).toEqual(["2026-09-05"]);
  });

  it("editing the amount only affects future charges; applied ones keep their snapshot (FR-011)", () => {
    const applied = [apply(rent, "2026-09-05"), apply(rent, "2026-10-05")];
    const raised = { ...rent, amount: cents(900_000) };
    const due = dueOccurrences([raised], applied, d("2026-11-10"));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ occurrenceDate: "2026-11-05", amount: 900_000 });
  });

  it("moving the charge day after this month's charge never charges the month twice (FR-011)", () => {
    const applied = [apply(rent, "2026-11-05")];
    const moved = { ...rent, startsOn: d("2026-11-01"), chargeDay: 20 };
    expect(dueOccurrences([moved], applied, d("2026-11-25"))).toEqual([]);
    expect(dates(dueOccurrences([moved], applied, d("2026-12-25")))).toEqual(["2026-12-20"]);
  });

  it("ignores expenses that are not this recurring expense's occurrences", () => {
    const other = makeExpense({ spentOn: d("2026-11-05") });
    expect(
      dates(dueOccurrences([{ ...rent, startsOn: d("2026-11-01") }], [other], d("2026-11-10"))),
    ).toEqual(["2026-11-05"]);
  });
});

describe("pendingOccurrences", () => {
  const nov2 = periodOf(d("2026-11-20"));

  it("returns this quincena's charges after today that aren't applied yet", () => {
    const internet = makeRecurring({ chargeDay: 25, startsOn: d("2026-01-01") });
    const early = makeRecurring({ chargeDay: 17, startsOn: d("2026-01-01") });
    const firstHalf = makeRecurring({ chargeDay: 3, startsOn: d("2026-01-01") });
    const pending = pendingOccurrences([internet, early, firstHalf], [], nov2, d("2026-11-20"));
    expect(dates(pending)).toEqual(["2026-11-25"]);
  });

  it("a charge due today is due, not pending", () => {
    const today = makeRecurring({ chargeDay: 20, startsOn: d("2026-01-01") });
    expect(pendingOccurrences([today], [], nov2, d("2026-11-20"))).toEqual([]);
  });

  it("paused or not-yet-started recurring expenses have nothing pending", () => {
    const paused = makeRecurring({
      chargeDay: 25,
      startsOn: d("2026-01-01"),
      endedOn: d("2026-11-19"),
    });
    const future = makeRecurring({ chargeDay: 25, startsOn: d("2026-12-01") });
    expect(pendingOccurrences([paused, future], [], nov2, d("2026-11-20"))).toEqual([]);
  });

  it("the whole quincena is pending before it starts (reserved from day one, FR-008a)", () => {
    const rentDay1 = makeRecurring({ chargeDay: 1, startsOn: d("2026-01-01") });
    const dec1 = periodOf(d("2026-12-01"));
    expect(dates(pendingOccurrences([rentDay1], [], dec1, d("2026-11-30")))).toEqual([
      "2026-12-01",
    ]);
  });
});

describe("recurringStatusForPeriod", () => {
  it("lists applied (snapshot amount) and unapplied charges of the quincena", () => {
    const nov1 = periodOf(d("2026-11-10"));
    const internet = makeRecurring({
      name: "Internet",
      chargeDay: 12,
      amount: cents(60_000),
      startsOn: d("2026-01-01"),
    });
    const applied = [apply(rent, "2026-11-05", cents(750_000))];
    const items = recurringStatusForPeriod([rent, internet], applied, nov1);
    expect(items).toEqual([
      expect.objectContaining({
        name: "Rent",
        date: "2026-11-05",
        amount: 750_000,
        status: "applied",
      }),
      expect.objectContaining({
        name: "Internet",
        date: "2026-11-12",
        amount: 60_000,
        status: "pending",
      }),
    ]);
  });
});

describe("quincena by the real payday (spec 006)", () => {
  const calendar = buildPayCalendar(DEFAULT_USER_SETTINGS, []);
  const day31 = makeRecurring({ name: "Gym", chargeDay: 31, startsOn: d("2026-01-01") });

  it("a charge on Sat Oct 31 2026 is reserved in the first half of November (paid Fri Oct 30)", () => {
    const nov1 = periodOfDate(d("2026-10-30"), calendar);
    const oct2 = periodOfDate(d("2026-10-29"), calendar);
    expect(dates(pendingOccurrences([day31], [], nov1, d("2026-10-30")))).toEqual(["2026-10-31"]);
    expect(pendingOccurrences([day31], [], oct2, d("2026-10-20"))).toEqual([]);
  });

  it("the status list uses the effective range too", () => {
    const nov1 = periodOfDate(d("2026-11-01"), calendar);
    const items = recurringStatusForPeriod(
      [day31],
      [apply(day31, "2026-10-31", cents(1_000))],
      nov1,
    );
    expect(items).toEqual([expect.objectContaining({ date: "2026-10-31", status: "applied" })]);
  });
});

describe("retroactiveChargeCount", () => {
  const internet = makeRecurring({ chargeDay: 1, startsOn: d("2026-11-05") });
  const today = d("2026-11-05");

  it("counts the charge a backdated start brings into the current month", () => {
    expect(retroactiveChargeCount(internet, internet.startsOn, [], today)).toBe(0);
    expect(retroactiveChargeCount(internet, d("2026-11-01"), [], today)).toBe(1);
    expect(retroactiveChargeCount(internet, d("2026-09-01"), [], today)).toBe(3);
  });

  it("ignores months already applied", () => {
    const applied = [apply(internet, "2026-10-01")];
    expect(retroactiveChargeCount(internet, d("2026-10-01"), applied, today)).toBe(1);
  });

  it("is 0 for a start date in the future", () => {
    expect(retroactiveChargeCount(internet, d("2026-12-01"), [], today)).toBe(0);
  });
});
