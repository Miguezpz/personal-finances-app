/**
 * Display-only currency conversion (US6, FR-032…036, research.md R11). Every amount is stored in
 * MXN cents; this only computes what <Money> shows in USD/EUR. Nothing converted is ever saved.
 *
 * Rates are decimals ("units of the target currency per 1 MXN", e.g. 0.05342). The product is done
 * with integers scaled by 1e10 and rounded half away from zero, so an exact half never flips due to
 * floating-point error and huge amounts stay exact.
 */
import type { Cents, DisplayCurrency, FxSnapshot } from "./types";

const SCALE = 10_000_000_000n; // 1e10
const HALF = SCALE / 2n;

export const DEFAULT_MAX_RATE_DEVIATION = 0.2;

/** Converts MXN cents to cents of `to`. MXN — or no rate available — returns the same amount. */
export function convert(amount: Cents, to: DisplayCurrency, fx: FxSnapshot | null): Cents {
  if (to === "MXN" || fx === null) return amount;
  const rate = fx.rates[to];
  const scaledRate = BigInt(Math.round(rate * Number(SCALE)));
  const magnitude = (BigInt(Math.abs(amount)) * scaledRate + HALF) / SCALE;
  const result = Number(magnitude);
  return (amount < 0 && result !== 0 ? -result : result) as Cents;
}

const validRate = (r: number) => Number.isFinite(r) && r > 0;

/**
 * Rejects rates ≤ 0, non-finite, or that moved more than `maxDeviation` (20%) from the previous
 * known rate in either currency (a broken source must never silently distort every amount).
 */
export function isPlausibleRate(
  next: FxSnapshot["rates"],
  previous: FxSnapshot["rates"] | null,
  maxDeviation = DEFAULT_MAX_RATE_DEVIATION,
): boolean {
  if (!validRate(next.USD) || !validRate(next.EUR)) return false;
  if (!previous || !validRate(previous.USD) || !validRate(previous.EUR)) return true;
  return (["USD", "EUR"] as const).every(
    (c) => Math.abs(next[c] / previous[c] - 1) <= maxDeviation,
  );
}
