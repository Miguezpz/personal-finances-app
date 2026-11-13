/**
 * Goals (FR-030, research.md R14): sinking funds hold back a monthly amount; the emergency fund is
 * measured against N months of vital expenses. Contributions are dated on the first quincena of
 * the month and, when their source is Needs or Wants, lower that bucket's Safe-to-Spend
 * (safe-to-spend.ts); Investment contributions don't.
 *
 * Spec 014: Saved (spec 013) can be assigned to a goal and returned. Moves carry a signed amount
 * (+ assign, − return), so everything is a sum and nothing derived is stored:
 *   net(goal)  = Σ its moves
 *   available  = Saved total − Σ all moves (every goal, archived and completed too)
 * A purchase goal only grows from Saved; the emergency fund and sinking funds add their net.
 */
import { addMonthsToMonthStart, monthStart } from "./dates";
import type { Cents, Expense, Goal, GoalContribution, IsoDate, SavedMove, Uuid } from "./types";

/** What the goal holds from Saved (assigned − returned). */
export function netFromSaved(goalId: Uuid, moves: readonly SavedMove[]): Cents {
  return moves.filter((m) => m.goalId === goalId).reduce((s, m) => s + m.amount, 0) as Cents;
}

/** FR-001/002: the real value can be negative; the UI shows max(·, 0) and a notice when `over`. */
export function availableToAssign(
  savedTotal: Cents,
  moves: readonly SavedMove[],
): { available: Cents; over: boolean } {
  const available = moves.reduce((s, m) => s - m.amount, savedTotal as number);
  return { available: available as Cents, over: available < 0 };
}

/** FR-007: the bar is capped at 1; `saved` is the real net, which can pass the target. */
export function purchaseProgress(
  goal: Goal,
  moves: readonly SavedMove[],
): { saved: Cents; target: Cents; ratio: number } {
  const saved = netFromSaved(goal.id, moves);
  const target = (goal.target ?? 0) as Cents;
  return { saved, target, ratio: target > 0 ? Math.min(Math.max(saved / target, 0), 1) : 0 };
}

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
  moves: readonly SavedMove[] = [],
): EmergencyFundProgress {
  const saved =
    contributions.filter((c) => c.goalId === goal.id).reduce((sum, c) => sum + c.amount, 0) +
    netFromSaved(goal.id, moves);

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
