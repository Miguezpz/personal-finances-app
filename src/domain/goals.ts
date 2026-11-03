/**
 * Goals (FR-030, research.md R14): sinking funds hold back a monthly amount; the emergency fund is
 * measured against N months of vital expenses. Contributions are dated on the first quincena of
 * the month and, when their source is Needs or Wants, lower that bucket's Safe-to-Spend
 * (safe-to-spend.ts); Investment contributions don't.
 */
import { addMonthsToMonthStart, monthStart } from "./dates";
import type { Cents, Expense, Goal, GoalContribution, IsoDate } from "./types";

/** Monthly hold-back for an annual amount, rounded up so 12 months cover it. */
export function suggestedMonthly(annual: Cents): Cents {
  return Math.ceil(annual / 12) as Cents;
}

/**
 * Contributions still missing for the current month (idempotent per goal and month). Only the
 * current month is due: a month that already passed is not charged retroactively, so archiving a
 * goal pauses it and restoring it resumes from the current month.
 */
export function dueContributions(
  goals: readonly Goal[],
  existing: readonly GoalContribution[],
  today: IsoDate,
): Array<Omit<GoalContribution, "id">> {
  const periodStart = monthStart(today);
  const done = new Set(existing.map((c) => `${c.goalId}|${c.periodStart}`));
  return goals
    .filter((g) => !g.archived && g.monthly !== null && g.monthly > 0)
    .filter((g) => !done.has(`${g.id}|${periodStart}`))
    .map((g) => ({
      goalId: g.id,
      periodStart,
      amount: g.monthly as Cents,
      sourceBucket: g.sourceBucket,
    }));
}

export interface EmergencyFundProgress {
  saved: Cents;
  /** Average monthly Needs spending of the last (up to) 3 complete months. */
  vitalMonthly: Cents;
  /** vitalMonthly × targetMonths. */
  target: Cents;
  /** saved / vitalMonthly (0 without history). */
  monthsCovered: number;
}

export const VITAL_EXPENSE_MONTHS = 3;

export function emergencyFundProgress(
  goal: Goal,
  contributions: readonly GoalContribution[],
  expenses: readonly Expense[],
  today: IsoDate,
): EmergencyFundProgress {
  const saved = contributions
    .filter((c) => c.goalId === goal.id)
    .reduce((sum, c) => sum + c.amount, 0);

  const windowEnd = monthStart(today); // exclusive: the current month isn't complete
  const windowStart = addMonthsToMonthStart(windowEnd, -VITAL_EXPENSE_MONTHS);
  let firstNeeds: IsoDate | null = null;
  let total = 0;
  for (const e of expenses) {
    if (e.bucket !== "needs" || e.spentOn >= windowEnd) continue;
    if (firstNeeds === null || e.spentOn < firstNeeds) firstNeeds = e.spentOn;
    if (e.spentOn >= windowStart) total += e.amount;
  }
  // With less history, average over the complete months since the first Needs expense.
  let months = 0;
  if (firstNeeds !== null) {
    const firstMonth = monthStart(firstNeeds);
    for (let m = 0; m < VITAL_EXPENSE_MONTHS; m++) {
      if (addMonthsToMonthStart(windowStart, m) >= firstMonth) months++;
    }
  }
  const vitalMonthly = months > 0 ? Math.round(total / months) : 0;
  const target = vitalMonthly * (goal.targetMonths ?? 0);
  return {
    saved: saved as Cents,
    vitalMonthly: vitalMonthly as Cents,
    target: target as Cents,
    monthsCovered: vitalMonthly > 0 ? Math.round((saved / vitalMonthly) * 10) / 10 : 0,
  };
}
