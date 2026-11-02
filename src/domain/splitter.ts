/**
 * Income splitter (US1, FR-001…FR-006, research.md R1/R3).
 *
 * An income is split first between Needs / Wants / Investment with `allocateByWeights` (cents
 * remainder → largest share; ties: Needs > Wants > Investment), then the Investment share is
 * split between its vehicles by the sub-rules. Σ allocations === amount, always (SC-001).
 */
import { addDays } from "./dates";
import { InvalidDateError, InvalidWeightsError, RuleNotConfiguredError } from "./errors";
import { allocateByWeights } from "./money";
import { isPeriodStart } from "./periods";
import type { Cents, DistributionRule, Income, IncomeAllocation, IsoDate } from "./types";

export type NewAllocation = Omit<IncomeAllocation, "id" | "incomeId">;

export interface SplitResult {
  /** One allocation for Needs, one for Wants and one per investment vehicle. */
  allocations: readonly NewAllocation[];
  /** Σ allocations.amount === amount (guaranteed). */
  total: Cents;
}

/** Rule in effect on a date: the greatest `effectiveFrom` ≤ date; null if there is none. */
export function effectiveRule(
  rules: readonly DistributionRule[],
  on: IsoDate,
): DistributionRule | null {
  let best: DistributionRule | null = null;
  for (const rule of rules) {
    if (rule.effectiveFrom <= on && (!best || rule.effectiveFrom > best.effectiveFrom)) best = rule;
  }
  return best;
}

/**
 * Splits an income by `rule` into the quincena starting on `fundedPeriodStart`.
 * @throws RuleNotConfiguredError when `rule` is null.
 * @throws InvalidWeightsError when the rule or its sub-rules don't sum to 10000 bps.
 * @throws InvalidDateError when `fundedPeriodStart` isn't day 1 or 16.
 */
export function splitIncome(
  amount: Cents,
  rule: DistributionRule | null,
  fundedPeriodStart: IsoDate,
): SplitResult {
  if (!rule) throw new RuleNotConfiguredError();
  if (!isPeriodStart(fundedPeriodStart)) {
    throw new InvalidDateError(`A funded period starts on day 1 or 16, got ${fundedPeriodStart}`);
  }

  const [needs, wants, investment] = allocateByWeights(amount, [
    rule.needs,
    rule.wants,
    rule.investment,
  ]) as [Cents, Cents, Cents];

  const allocations: NewAllocation[] = [
    { bucket: "needs", accountId: null, amount: needs, periodStart: fundedPeriodStart },
    { bucket: "wants", accountId: null, amount: wants, periodStart: fundedPeriodStart },
  ];

  if (rule.investment > 0) {
    if (rule.investmentSubrules.length === 0) {
      throw new InvalidWeightsError("Investment share > 0 requires at least one vehicle");
    }
    const vehicles = allocateByWeights(
      investment,
      rule.investmentSubrules.map((s) => s.pct),
    );
    rule.investmentSubrules.forEach((s, i) => {
      allocations.push({
        bucket: "investment",
        accountId: s.accountId,
        amount: vehicles[i] as Cents,
        periodStart: fundedPeriodStart,
      });
    });
  }

  return { allocations, total: amount };
}

/**
 * Effective date for a rule saved today (FR-005 and the same-day edge case): today — overwriting
 * today's rule if it has no incomes yet — or tomorrow if today's rule was already used by an
 * income (that rule is a snapshot and must not change).
 */
export function nextRuleEffectiveDate(
  rules: readonly DistributionRule[],
  incomes: readonly Pick<Income, "ruleId">[],
  today: IsoDate,
): IsoDate {
  const todays = rules.find((r) => r.effectiveFrom === today);
  if (todays && incomes.some((i) => i.ruleId === todays.id)) return addDays(today, 1);
  return today;
}
