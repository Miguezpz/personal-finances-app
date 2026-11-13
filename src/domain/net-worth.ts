/**
 * Net worth (FR-031, data-model.md):
 *   assets      = Σ opening balances of non-card accounts + Σ allocations to Investment
 *               + Σ goal contributions from Needs/Wants + Σ third-party installments still owed
 *               + current available Needs and Wants (signed)
 *   liabilities = Σ total card debt (includes the full outstanding MSI)
 * A snapshot is stored once per month (dated the 1st) for the historical chart.
 */
import { cardStatus } from "./credit";
import { monthStart } from "./dates";
import { buildPayCalendar, periodOfDate } from "./pay-calendar";
import { computeSafeToSpend } from "./safe-to-spend";
import type { Cents, FinanceSnapshot, IsoDate, NetWorthSnapshot } from "./types";

export interface NetWorth {
  assets: Cents;
  liabilities: Cents;
  netWorth: Cents;
}

export function computeNetWorth(s: FinanceSnapshot, asOf: IsoDate): NetWorth {
  let assets = 0;
  for (const a of s.accounts) if (a.kind !== "credit_card") assets += a.openingBalance;
  for (const a of s.allocations) if (a.bucket === "investment") assets += a.amount;
  for (const c of s.contributions) if (c.sourceBucket !== "investment") assets += c.amount;
  for (const n of s.installments) assets += Math.max(0, n.amount - n.collected);

  const calendar = buildPayCalendar(s.settings, s.incomes);
  const sts = computeSafeToSpend({
    period: periodOfDate(asOf, calendar),
    calendar,
    today: asOf,
    settings: s.settings,
    allocations: s.allocations,
    expenses: s.expenses,
    recurring: s.recurring,
    goals: s.goals,
    contributions: s.contributions,
  });
  assets += sts.needs.available + sts.wants.available;

  let liabilities = 0;
  for (const card of s.accounts) {
    if (
      card.kind === "credit_card" &&
      card.cutOffDay !== null &&
      card.paymentDueOffsetDays !== null
    ) {
      liabilities += cardStatus(card, s, asOf).totalDebt;
    }
  }

  return {
    assets: assets as Cents,
    liabilities: liabilities as Cents,
    netWorth: (assets - liabilities) as Cents,
  };
}

/** This month's snapshot if it hasn't been taken yet (idempotent per month), else null. */
export function dueNetWorthSnapshot(
  existing: readonly Pick<NetWorthSnapshot, "snapshotOn">[],
  value: NetWorth,
  today: IsoDate,
): Omit<NetWorthSnapshot, "id"> | null {
  const snapshotOn = monthStart(today);
  if (existing.some((x) => x.snapshotOn === snapshotOn)) return null;
  return { snapshotOn, ...value };
}
