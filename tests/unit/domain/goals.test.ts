/**
 * T139 · Goals (FR-030, US10-2/3).
 *  - A sinking fund of $12,000 a year holds back $1,000 every month from its source bucket,
 *    idempotent per (goal, month); archived goals don't contribute; a month that already passed
 *    is not charged retroactively (only the current month is due).
 *  - Emergency fund: vital expenses = monthly average of Needs expenses applied in the last 3
 *    complete months (fewer if there is less history); progress = saved / vital expenses.
 */
import { describe, expect, it } from "vitest";
import { dueContributions, emergencyFundProgress, suggestedMonthly } from "@/domain/goals";
import { cents } from "@/domain/money";
import type { GoalContribution } from "@/domain/types";
import { d, makeExpense, makeGoal, testId } from "../../utils/fixtures";

const contribution = (goalId: string, periodStart: string, amount = 100_000): GoalContribution => ({
  id: testId(),
  goalId: goalId as never,
  periodStart: d(periodStart),
  amount: cents(amount),
  sourceBucket: "needs",
});

describe("suggestedMonthly", () => {
  it("splits the annual amount in 12, rounding up so a year covers it", () => {
    expect(suggestedMonthly(cents(1_200_000))).toBe(100_000);
    expect(suggestedMonthly(cents(1_000_000))).toBe(83_334);
  });
});

describe("dueContributions", () => {
  const goal = makeGoal({
    annual: cents(1_200_000),
    monthly: cents(100_000),
    sourceBucket: "needs",
  });

  it("holds back the monthly amount on the first quincena of the current month", () => {
    expect(dueContributions([goal], [], d("2026-11-20"))).toEqual([
      { goalId: goal.id, periodStart: "2026-11-01", amount: 100_000, sourceBucket: "needs" },
    ]);
  });

  it("is idempotent per goal and month", () => {
    expect(
      dueContributions([goal], [contribution(goal.id, "2026-11-01")], d("2026-11-20")),
    ).toEqual([]);
    expect(
      dueContributions([goal], [contribution(goal.id, "2026-11-01")], d("2026-12-01")),
    ).toEqual([
      { goalId: goal.id, periodStart: "2026-12-01", amount: 100_000, sourceBucket: "needs" },
    ]);
  });

  it("doesn't charge months that already passed", () => {
    const due = dueContributions([goal], [contribution(goal.id, "2026-08-01")], d("2026-11-03"));
    expect(due.map((c) => c.periodStart)).toEqual(["2026-11-01"]);
  });

  it("skips archived goals and goals without a monthly amount, and uses each goal's bucket", () => {
    const archived = makeGoal({ archived: true });
    const fund = makeGoal({ kind: "emergency_fund", targetMonths: 6, annual: null, monthly: null });
    const invest = makeGoal({
      kind: "emergency_fund",
      targetMonths: 6,
      annual: null,
      monthly: cents(50_000),
      sourceBucket: "investment",
    });
    expect(dueContributions([archived, fund, invest], [], d("2026-11-03"))).toEqual([
      { goalId: invest.id, periodStart: "2026-11-01", amount: 50_000, sourceBucket: "investment" },
    ]);
  });
});

describe("emergencyFundProgress", () => {
  const fund = makeGoal({
    kind: "emergency_fund",
    targetMonths: 6,
    annual: null,
    monthly: cents(200_000),
    sourceBucket: "investment",
  });
  const saved = [
    contribution(fund.id, "2026-09-01", 200_000),
    contribution(fund.id, "2026-10-01", 200_000),
    contribution(fund.id, "2026-11-01", 200_000),
    contribution("other-goal", "2026-11-01", 999_999),
  ];
  const needs = (amount: number, on: string) =>
    makeExpense({ amount: cents(amount), spentOn: d(on), bucket: "needs" });

  it("compares the saved amount against N months of average Needs spending (last 3 full months)", () => {
    const expenses = [
      needs(100_000, "2026-07-31"), // outside the window
      needs(300_000, "2026-08-10"),
      needs(200_000, "2026-09-05"),
      needs(100_000, "2026-09-25"),
      needs(600_000, "2026-10-15"),
      needs(900_000, "2026-11-02"), // current month: not complete yet
      makeExpense({ amount: cents(500_000), spentOn: d("2026-10-01"), bucket: "wants" }),
    ];
    expect(emergencyFundProgress(fund, saved, expenses, d("2026-11-12"))).toEqual({
      saved: 600_000,
      vitalMonthly: 400_000,
      target: 2_400_000,
      monthsCovered: 1.5,
    });
  });

  it("with less history, averages over the months available", () => {
    const expenses = [needs(300_000, "2026-09-20"), needs(500_000, "2026-10-20")];
    expect(emergencyFundProgress(fund, saved, expenses, d("2026-11-12"))).toMatchObject({
      vitalMonthly: 400_000,
      target: 2_400_000,
    });
  });

  it("without Needs history there is no target yet", () => {
    expect(emergencyFundProgress(fund, saved, [], d("2026-11-12"))).toEqual({
      saved: 600_000,
      vitalMonthly: 0,
      target: 0,
      monthsCovered: 0,
    });
  });
});
