/**
 * Safe-to-Spend per quincena and bucket (US2, FR-016/016a/017/020, data-model.md, research R4).
 *
 *   closing(b,p)   = carry(b,p) + allocated − fixedApplied − manual − goalContrib
 *   carry(b,p+1)   = closing(b,p)              (the first period with data starts at 0)
 *   available(b,p) = carry + allocated − fixedApplied − fixedPending − manual − goalContrib
 *   base(b,p)      = allocated + max(carry, 0)  (a negative carry never raises the base)
 *
 * The carry is DERIVED, never stored, so editing or deleting any past movement recalculates the
 * whole chain. Third-party (MSI) charges are receivables, never Expense rows, so they can't enter.
 * Pure and O(movements + periods).
 */
import { BPS_TOTAL, ZERO_CENTS } from "./money";
import { daysUntilNextPayday, nextPeriod, periodFromKey, periodOf } from "./periods";
import type {
  BasisPoints,
  Cents,
  Expense,
  Goal,
  GoalContribution,
  IncomeAllocation,
  IsoDate,
  Period,
  PeriodKey,
  RecurringExpense,
  SpendBucket,
  TrafficLight,
  UserSettings,
} from "./types";

export interface BucketSafeToSpend {
  bucket: SpendBucket;
  /** Carry from the previous quincena (may be negative). */
  carryIn: Cents;
  allocated: Cents;
  fixedApplied: Cents;
  /** Recurring charges of this quincena not applied yet (reserved from day 1, FR-008a). */
  fixedPending: Cents;
  manual: Cents;
  goalContributions: Cents;
  available: Cents;
  base: Cents;
  /** available / base in bps (can be negative or above 10000); null if base ≤ 0. */
  ratio: BasisPoints | null;
  light: TrafficLight;
}

export interface SafeToSpend {
  period: Period;
  needs: BucketSafeToSpend;
  wants: BucketSafeToSpend;
  daysUntilPayday: number;
}

export interface SafeToSpendInput {
  period: Period;
  today: IsoDate;
  settings: Pick<UserSettings, "greenMinBps" | "yellowMinBps" | "firstPayday" | "secondPayday">;
  allocations: readonly IncomeAllocation[];
  expenses: readonly Expense[];
  recurring: readonly RecurringExpense[];
  goals: readonly Goal[];
  contributions: readonly GoalContribution[];
}

const BUCKETS: readonly SpendBucket[] = ["needs", "wants"];

interface Movements {
  allocated: number;
  fixedApplied: number;
  manual: number;
  goalContributions: number;
}

const emptyMovements = (): Movements => ({
  allocated: 0,
  fixedApplied: 0,
  manual: 0,
  goalContributions: 0,
});
const closingDelta = (m: Movements) =>
  m.allocated - m.fixedApplied - m.manual - m.goalContributions;

/** Groups every movement by period key and bucket, ignoring anything after `upTo`. */
function groupByPeriod(input: Omit<SafeToSpendInput, "period">, upTo: Period) {
  const byPeriod = new Map<PeriodKey, Record<SpendBucket, Movements>>();
  let first: Period | null = null;

  const at = (date: IsoDate, bucket: SpendBucket): Movements | null => {
    if (date > upTo.end) return null;
    const period = periodOf(date);
    if (!first || period.start < first.start) first = period;
    let entry = byPeriod.get(period.key);
    if (!entry) {
      entry = { needs: emptyMovements(), wants: emptyMovements() };
      byPeriod.set(period.key, entry);
    }
    return entry[bucket];
  };

  for (const a of input.allocations) {
    if (a.bucket === "investment") continue;
    const m = at(a.periodStart, a.bucket);
    if (m) m.allocated += a.amount;
  }
  for (const e of input.expenses) {
    const m = at(e.spentOn, e.bucket);
    if (!m) continue;
    if (e.origin === "recurring") m.fixedApplied += e.amount;
    else m.manual += e.amount;
  }
  for (const c of input.contributions) {
    if (c.sourceBucket === "investment") continue; // investment never touches Safe-to-Spend
    const m = at(c.periodStart, c.sourceBucket);
    if (m) m.goalContributions += c.amount;
  }
  return { byPeriod, first: first as Period | null };
}

/** Closing balance of every quincena (with or without data) from the first one with data to `upTo`. */
export function computeCarryChain(
  input: Omit<SafeToSpendInput, "period">,
  upTo: PeriodKey,
): ReadonlyMap<PeriodKey, Record<SpendBucket, Cents>> {
  const target = periodFromKey(upTo);
  const { byPeriod, first } = groupByPeriod(input, target);
  const chain = new Map<PeriodKey, Record<SpendBucket, Cents>>();
  if (!first) return chain;

  const balance: Record<SpendBucket, number> = { needs: 0, wants: 0 };
  for (let p: Period = first; p.start <= target.start; p = nextPeriod(p)) {
    const movements = byPeriod.get(p.key);
    for (const b of BUCKETS) {
      if (movements) balance[b] += closingDelta(movements[b]);
    }
    chain.set(p.key, { needs: balance.needs as Cents, wants: balance.wants as Cents });
  }
  return chain;
}

/** Color of a bucket (FR-017). Integer comparison (no division); exact for any safe amount. */
export function trafficLight(
  available: Cents,
  base: Cents,
  thresholds: Pick<UserSettings, "greenMinBps" | "yellowMinBps">,
): TrafficLight {
  if (base <= 0) return available < 0 ? "red" : "neutral";
  if (available < 0) return "red";
  const scaled = BigInt(available) * BigInt(BPS_TOTAL);
  if (scaled >= BigInt(thresholds.greenMinBps) * BigInt(base)) return "green";
  if (scaled >= BigInt(thresholds.yellowMinBps) * BigInt(base)) return "yellow";
  return "red";
}

function ratioOf(available: number, base: number): BasisPoints | null {
  if (base <= 0) return null;
  return Number((BigInt(available) * BigInt(BPS_TOTAL)) / BigInt(base)) as BasisPoints;
}

/**
 * Recurring charges of the period that are not applied yet, by bucket (reserved from the first
 * day, FR-008a). US3 (T083) computes them from `input.recurring` with pendingOccurrences; until
 * then nothing is pending.
 */
function pendingFixedOf(): Record<SpendBucket, Cents> {
  return { needs: ZERO_CENTS, wants: ZERO_CENTS };
}

export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpend {
  const { period } = input;
  const chain = computeCarryChain(input, period.key);
  const { byPeriod } = groupByPeriod(input, period);
  const current = byPeriod.get(period.key);
  const pending = pendingFixedOf();

  // Closing of the target period includes its own movements; carryIn is that minus them.
  const closing = chain.get(period.key) ?? { needs: ZERO_CENTS, wants: ZERO_CENTS };

  const bucket = (b: SpendBucket): BucketSafeToSpend => {
    const m = current?.[b] ?? emptyMovements();
    const carryIn = closing[b] - closingDelta(m);
    const available = carryIn + closingDelta(m) - pending[b];
    const base = m.allocated + Math.max(carryIn, 0);
    return {
      bucket: b,
      carryIn: carryIn as Cents,
      allocated: m.allocated as Cents,
      fixedApplied: m.fixedApplied as Cents,
      fixedPending: pending[b],
      manual: m.manual as Cents,
      goalContributions: m.goalContributions as Cents,
      available: available as Cents,
      base: base as Cents,
      ratio: ratioOf(available, base),
      light: trafficLight(available as Cents, base as Cents, input.settings),
    };
  };

  return {
    period,
    needs: bucket("needs"),
    wants: bucket("wants"),
    daysUntilPayday: daysUntilNextPayday(input.today, input.settings),
  };
}
