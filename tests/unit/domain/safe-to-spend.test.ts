/**
 * T068 · Safe-to-Spend and the carry chain (US2, FR-016/016a/020, data-model.md formulas).
 *   closing(b,p)   = carry(b,p) + allocated − fixedApplied − manual − goalContrib
 *   carry(b,p+1)   = closing(b,p)            (the first period with data starts at 0)
 *   available(b,p) = carry + allocated − fixedApplied − fixedPending − manual − goalContrib
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TAXONOMY } from "@/domain/default-taxonomy";
import { cents } from "@/domain/money";
import { buildPayCalendar, periodOfDate } from "@/domain/pay-calendar";
import { periodFromKey } from "@/domain/periods";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import {
  computeCarryChain,
  computeSafeToSpend,
  type SafeToSpendInput,
} from "@/domain/safe-to-spend";
import type { IsoDate, PeriodKey } from "@/domain/types";
import {
  d,
  makeAllocation,
  makeExpense,
  makeGoal,
  makeRecurring,
  testId,
} from "../../utils/fixtures";

const NOV_2 = periodFromKey("2026-11-2" as PeriodKey); // Nov 16–30
const settings = DEFAULT_USER_SETTINGS;
const calendar = buildPayCalendar(settings, []);

function input(overrides: Partial<SafeToSpendInput> = {}): SafeToSpendInput {
  return {
    period: NOV_2,
    today: d("2026-11-20"),
    settings,
    calendar,
    allocations: [],
    expenses: [],
    recurring: [],
    goals: [],
    contributions: [],
    ...overrides,
  };
}

const alloc = (bucket: "needs" | "wants" | "investment", amount: number, periodStart: string) =>
  makeAllocation({
    bucket,
    amount: cents(amount),
    periodStart: d(periodStart),
    accountId: bucket === "investment" ? testId() : null,
  });

const spend = (
  bucket: "needs" | "wants",
  amount: number,
  on: string,
  origin: "manual" | "recurring" = "manual",
) =>
  makeExpense({
    bucket,
    amount: cents(amount),
    spentOn: d(on),
    origin,
    ...(origin === "recurring" ? { recurringExpenseId: testId(), occurrenceDate: d(on) } : {}),
  });

describe("computeSafeToSpend", () => {
  it("spec 004 FR-004: an expense in Previous Balances comes out of Needs this quincena", () => {
    const previous = DEFAULT_TAXONOMY.find((c) => c.name === "Previous Balances");
    expect(previous?.macro).toBe("needs");
    const r = computeSafeToSpend(
      input({
        allocations: [alloc("needs", 500_000, "2026-11-16"), alloc("wants", 300_000, "2026-11-16")],
        // The expense inherits the bucket of its category, like any other Needs expense.
        expenses: [spend(previous?.macro ?? "wants", 120_000, "2026-11-18")],
      }),
    );
    expect(r.needs.manual).toBe(120_000);
    expect(r.needs.available).toBe(380_000);
    expect(r.wants.available).toBe(300_000);
  });

  it("US2-1: Wants $3,000 − fixed $500 − manual $700 = $1,800", () => {
    const r = computeSafeToSpend(
      input({
        allocations: [alloc("wants", 300_000, "2026-11-16")],
        expenses: [
          spend("wants", 50_000, "2026-11-18", "recurring"),
          spend("wants", 30_000, "2026-11-17"),
          spend("wants", 40_000, "2026-11-19"),
        ],
      }),
    );
    expect(r.wants).toMatchObject({
      carryIn: 0,
      allocated: 300_000,
      fixedApplied: 50_000,
      fixedPending: 0,
      manual: 70_000,
      goalContributions: 0,
      available: 180_000,
      base: 300_000,
    });
    expect(r.period).toEqual(NOV_2);
  });

  it("US2-6: a $400 surplus carries into the same bucket only (Needs unaffected)", () => {
    const r = computeSafeToSpend(
      input({
        allocations: [
          alloc("wants", 300_000, "2026-11-01"),
          alloc("needs", 500_000, "2026-11-01"),
          alloc("wants", 300_000, "2026-11-16"),
          alloc("needs", 500_000, "2026-11-16"),
        ],
        expenses: [spend("wants", 260_000, "2026-11-10"), spend("needs", 500_000, "2026-11-03")],
      }),
    );
    expect(r.wants.carryIn).toBe(40_000);
    expect(r.wants.available).toBe(340_000);
    expect(r.needs.carryIn).toBe(0);
    expect(r.needs.available).toBe(500_000);
  });

  it("US2-6: a $400 deficit carries as −$400", () => {
    const r = computeSafeToSpend(
      input({
        allocations: [alloc("wants", 300_000, "2026-11-01"), alloc("wants", 300_000, "2026-11-16")],
        expenses: [spend("wants", 340_000, "2026-11-12")],
      }),
    );
    expect(r.wants.carryIn).toBe(-40_000);
    expect(r.wants.available).toBe(260_000);
    // A negative carry does not raise the base (FR-017).
    expect(r.wants.base).toBe(300_000);
  });

  it("chains across several periods, months and an empty period in between", () => {
    const r = computeSafeToSpend(
      input({
        period: periodFromKey("2026-12-1" as PeriodKey),
        today: d("2026-12-05"),
        allocations: [alloc("wants", 100_000, "2026-10-16"), alloc("wants", 100_000, "2026-12-01")],
        expenses: [spend("wants", 30_000, "2026-10-20"), spend("wants", 10_000, "2026-11-05")],
        // Nov 16–30 has no data at all: the carry passes through unchanged.
      }),
    );
    // Oct-2: 100k − 30k = 70k → Nov-1: 70k − 10k = 60k → Nov-2: 60k → Dec-1 carry 60k.
    expect(r.wants.carryIn).toBe(60_000);
    expect(r.wants.available).toBe(160_000);
    expect(r.wants.base).toBe(160_000);
  });

  it("editing a past expense recalculates the whole chain (FR-016a)", () => {
    const past = spend("wants", 30_000, "2026-11-05");
    const base = {
      allocations: [alloc("wants", 100_000, "2026-11-01"), alloc("wants", 100_000, "2026-11-16")],
    };
    const before = computeSafeToSpend(input({ ...base, expenses: [past] }));
    const after = computeSafeToSpend(
      input({ ...base, expenses: [{ ...past, amount: cents(90_000) }] }),
    );
    expect(before.wants.available).toBe(170_000);
    expect(after.wants.available).toBe(110_000);
  });

  it("ignores investment allocations, data after the period, and never sees third-party charges", () => {
    // Third-party MSI charges are receivables/installments, never Expense rows: they simply aren't
    // part of the input, so they can't affect the result (FR-020, SC-007).
    const r = computeSafeToSpend(
      input({
        allocations: [
          alloc("investment", 999_999, "2026-11-16"),
          alloc("needs", 100_000, "2026-11-16"),
        ],
        expenses: [spend("needs", 5_000, "2026-12-02")],
      }),
    );
    expect(r.needs.available).toBe(100_000);
    expect(r.wants.available).toBe(0);
  });

  it("subtracts goal contributions taken from Needs/Wants, not those from Investment", () => {
    const sinking = makeGoal({ sourceBucket: "needs" });
    const r = computeSafeToSpend(
      input({
        allocations: [alloc("needs", 100_000, "2026-11-16")],
        goals: [sinking],
        contributions: [
          {
            id: testId(),
            goalId: sinking.id,
            periodStart: d("2026-11-16"),
            amount: cents(10_000),
            sourceBucket: "needs",
          },
          {
            id: testId(),
            goalId: testId(),
            periodStart: d("2026-11-16"),
            amount: cents(50_000),
            sourceBucket: "investment",
          },
        ],
      }),
    );
    expect(r.needs.goalContributions).toBe(10_000);
    expect(r.needs.available).toBe(90_000);
  });

  it("allows negative balances and colors them red (FR-021)", () => {
    const r = computeSafeToSpend(
      input({
        allocations: [alloc("wants", 100_000, "2026-11-16")],
        expenses: [spend("wants", 150_000, "2026-11-20")],
      }),
    );
    expect(r.wants.available).toBe(-50_000);
    expect(r.wants.light).toBe("red");
  });

  it("returns zeros and a neutral light with no data at all", () => {
    const r = computeSafeToSpend(input());
    expect(r.needs).toMatchObject({ available: 0, base: 0, ratio: null, light: "neutral" });
  });

  it("reports the days until the next payday", () => {
    expect(computeSafeToSpend(input({ today: d("2026-11-20") })).daysUntilPayday).toBe(10);
  });
});

describe("computeCarryChain", () => {
  it("returns the closing balance of every period up to the target", () => {
    const chain = computeCarryChain(
      {
        today: d("2026-11-20"),
        settings,
        calendar,
        allocations: [alloc("wants", 100_000, "2026-11-01"), alloc("needs", 50_000, "2026-11-01")],
        expenses: [spend("wants", 20_000, "2026-11-03"), spend("needs", 60_000, "2026-11-16")],
        recurring: [],
        goals: [],
        contributions: [],
      },
      "2026-11-2" as PeriodKey,
    );
    expect([...chain.keys()]).toEqual(["2026-11-1", "2026-11-2"]);
    expect(chain.get("2026-11-1" as PeriodKey)).toEqual({ needs: 50_000, wants: 80_000 });
    expect(chain.get("2026-11-2" as PeriodKey)).toEqual({ needs: -10_000, wants: 80_000 });
  });

  it("is empty when there is no data up to the target", () => {
    const chain = computeCarryChain(
      {
        today: d("2026-11-20") as IsoDate,
        settings,
        calendar,
        allocations: [],
        expenses: [],
        recurring: [],
        goals: [],
        contributions: [],
      },
      "2026-11-2" as PeriodKey,
    );
    expect(chain.size).toBe(0);
  });
});

describe("recurring charges in the Safe-to-Spend (T083, FR-008a, US3-1)", () => {
  const rent = makeRecurring({
    chargeDay: 20,
    amount: cents(80_000),
    bucket: "needs",
    startsOn: d("2026-01-01"),
  });
  const base = { allocations: [alloc("needs", 300_000, "2026-11-16")], recurring: [rent] };

  it("reserves a charge from the first day of its quincena as pending", () => {
    const r = computeSafeToSpend(input({ ...base, today: d("2026-11-16") }));
    expect(r.needs.fixedPending).toBe(80_000);
    expect(r.needs.fixedApplied).toBe(0);
    expect(r.needs.available).toBe(220_000);
  });

  it("the balance doesn't change when the charge becomes applied", () => {
    const pending = computeSafeToSpend(input({ ...base, today: d("2026-11-19") }));
    const applied = computeSafeToSpend(
      input({
        ...base,
        today: d("2026-11-20"),
        expenses: [
          makeExpense({
            amount: rent.amount,
            spentOn: d("2026-11-20"),
            bucket: "needs",
            origin: "recurring",
            recurringExpenseId: rent.id,
            occurrenceDate: d("2026-11-20"),
          }),
        ],
      }),
    );
    expect(applied.needs).toMatchObject({ fixedPending: 0, fixedApplied: 80_000 });
    expect(applied.needs.available).toBe(pending.needs.available);
  });

  it("still reserves a past-due charge that hasn't been materialized yet", () => {
    const r = computeSafeToSpend(input({ ...base, today: d("2026-11-25") }));
    expect(r.needs.fixedPending).toBe(80_000);
  });

  it("doesn't reserve charges of other quincenas or of paused recurring expenses", () => {
    const firstHalf = makeRecurring({
      chargeDay: 3,
      amount: cents(10_000),
      bucket: "needs",
      startsOn: d("2026-01-01"),
    });
    const paused = { ...rent, id: testId(), endedOn: d("2026-11-10") };
    const r = computeSafeToSpend(
      input({ ...base, recurring: [firstHalf, paused], today: d("2026-11-16") }),
    );
    expect(r.needs.fixedPending).toBe(0);
  });
});

describe("quincena by the real payday (spec 006)", () => {
  // Nov 15 2026 is Sunday: the second half of November starts on Fri Nov 13.
  const NOV_2_REAL = periodOfDate(d("2026-11-13"), calendar);
  const allocations = [
    alloc("wants", 300_000, "2026-11-01"),
    alloc("wants", 300_000, "2026-11-16"),
  ];

  it("on payday the current quincena already has the new allocation", () => {
    expect(NOV_2_REAL).toMatchObject({ key: "2026-11-2", from: "2026-11-13", to: "2026-11-29" });
    const r = computeSafeToSpend(
      input({ period: NOV_2_REAL, today: d("2026-11-13"), allocations }),
    );
    expect(r.wants).toMatchObject({ carryIn: 300_000, allocated: 300_000, available: 600_000 });
    expect(r.daysUntilPayday).toBe(0);
  });

  it("an expense on payday comes out of the new quincena, not the previous one", () => {
    const r = computeSafeToSpend(
      input({
        period: NOV_2_REAL,
        today: d("2026-11-13"),
        allocations,
        expenses: [spend("wants", 20_000, "2026-11-13"), spend("wants", 50_000, "2026-11-12")],
      }),
    );
    expect(r.wants.carryIn).toBe(250_000); // Nov-1 closes with only the Nov 12 expense
    expect(r.wants.manual).toBe(20_000);
    expect(r.wants.available).toBe(530_000);
  });

  it("Sat Oct 31 2026 belongs to the first half of November (paid Fri Oct 30)", () => {
    const chain = computeCarryChain(
      input({
        allocations: [alloc("wants", 100_000, "2026-10-16")],
        expenses: [spend("wants", 10_000, "2026-10-31")],
      }),
      "2026-11-1" as PeriodKey,
    );
    expect(chain.get("2026-10-2" as PeriodKey)).toEqual({ needs: 0, wants: 100_000 });
    expect(chain.get("2026-11-1" as PeriodKey)).toEqual({ needs: 0, wants: 90_000 });
  });
});

describe("save surplus (spec 013)", () => {
  const on = { ...settings, saveSurplus: true };

  it("a +$400 Wants closing goes to Saved and doesn't carry", () => {
    const r = computeSafeToSpend(
      input({
        settings: on,
        allocations: [alloc("wants", 100_000, "2026-11-01"), alloc("wants", 100_000, "2026-11-16")],
        expenses: [spend("wants", 60_000, "2026-11-05")],
      }),
    );
    expect(r.wants).toMatchObject({ carryIn: 0, available: 100_000, base: 100_000 });
    expect(r.saved).toEqual({ lastPeriod: 40_000, total: 40_000 });
  });

  it("a −$400 closing still carries and adds nothing to Saved", () => {
    const r = computeSafeToSpend(
      input({
        settings: on,
        allocations: [alloc("wants", 100_000, "2026-11-01"), alloc("wants", 100_000, "2026-11-16")],
        expenses: [spend("wants", 140_000, "2026-11-05")],
      }),
    );
    expect(r.wants).toMatchObject({ carryIn: -40_000, available: 60_000 });
    expect(r.saved).toEqual({ lastPeriod: 0, total: 0 });
  });

  it("mixed buckets: Needs −$100 carries, Wants +$300 is saved", () => {
    const r = computeSafeToSpend(
      input({
        settings: on,
        allocations: [alloc("needs", 10_000, "2026-11-01"), alloc("wants", 30_000, "2026-11-01")],
        expenses: [spend("needs", 20_000, "2026-11-05")],
      }),
    );
    expect(r.needs.carryIn).toBe(-10_000);
    expect(r.wants.carryIn).toBe(0);
    expect(r.saved).toEqual({ lastPeriod: 30_000, total: 30_000 });
  });

  it("three quincenas of $100, $200 and $300 add up to 600; the last one is 300", () => {
    const r = computeSafeToSpend(
      input({
        settings: on,
        period: periodOfDate(d("2026-11-20"), calendar),
        allocations: [
          alloc("wants", 10_000, "2026-10-01"),
          alloc("wants", 20_000, "2026-10-16"),
          alloc("wants", 30_000, "2026-11-01"),
        ],
      }),
    );
    expect(r.wants.carryIn).toBe(0);
    expect(r.saved).toEqual({ lastPeriod: 30_000, total: 60_000 });
  });

  it("off: saved is null and the surplus carries as before", () => {
    const r = computeSafeToSpend(
      input({
        allocations: [alloc("wants", 100_000, "2026-11-01"), alloc("wants", 100_000, "2026-11-16")],
        expenses: [spend("wants", 60_000, "2026-11-05")],
      }),
    );
    expect(r.saved).toBeNull();
    expect(r.wants.carryIn).toBe(40_000);
  });

  it("computeCarryChain keeps the closing before the transfer", () => {
    const chain = computeCarryChain(
      input({ settings: on, allocations: [alloc("wants", 10_000, "2026-11-01")] }),
      "2026-11-2" as PeriodKey,
    );
    expect(chain.get("2026-11-1" as PeriodKey)).toEqual({ needs: 0, wants: 10_000 });
    expect(chain.get("2026-11-2" as PeriodKey)).toEqual({ needs: 0, wants: 0 });
  });

  it("owner's data on Nov 13 2026: Needs 2,442.87, Wants 1,470.93, Saved 2,327.90", () => {
    const today = d("2026-11-13");
    const r = computeSafeToSpend(
      input({
        settings: on,
        period: periodOfDate(today, calendar),
        today,
        allocations: [
          alloc("needs", 294_187, "2026-11-16"),
          alloc("needs", 250_794, "2026-11-01"),
          alloc("wants", 147_093, "2026-11-16"),
          alloc("wants", 125_396, "2026-11-01"),
        ],
        expenses: [spend("needs", 112_900, "2026-11-05"), spend("wants", 30_500, "2026-11-05")],
        recurring: [
          makeRecurring({ chargeDay: 18, amount: cents(49_900), startsOn: d("2026-11-05") }),
        ],
      }),
    );
    expect(r.needs.available).toBe(244_287);
    expect(r.wants.available).toBe(147_093);
    expect(r.saved).toEqual({ lastPeriod: 232_790, total: 232_790 });
  });
});
