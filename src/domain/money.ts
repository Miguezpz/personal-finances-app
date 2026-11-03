/**
 * Money and percentages as integers (Principle II, research.md R1).
 *  - Cents: integer MXN cents (may be negative for balances/debts). Never a float.
 *  - BasisPoints: integer 0–10000 (100% = 10000).
 */
import { InvalidMoneyError, InvalidWeightsError } from "./errors";
import type { BasisPoints, Cents } from "./types";

export const BPS_TOTAL = 10_000;

export const ZERO_CENTS = 0 as Cents;

/** Brands a safe integer as Cents. */
export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMoneyError(`Amount must be a safe integer number of cents, got ${value}`);
  }
  return value as Cents;
}

/** Brands an integer 0–10000 as BasisPoints. */
export function bps(value: number): BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > BPS_TOTAL) {
    throw new InvalidWeightsError(`Basis points must be an integer 0–${BPS_TOTAL}, got ${value}`);
  }
  return value as BasisPoints;
}

export const addCents = (a: Cents, b: Cents): Cents => cents(a + b);
export const subCents = (a: Cents, b: Cents): Cents => cents(a - b);
export const negateCents = (a: Cents): Cents => cents(a === 0 ? 0 : -a);

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return cents(total);
}

/** floor(total × w / 10000) without exceeding 2^53 in intermediate products. */
function floorShare(total: number, weight: number): number {
  const q = Math.floor(total / BPS_TOTAL);
  const r = total % BPS_TOTAL;
  return q * weight + Math.floor((r * weight) / BPS_TOTAL);
}

/**
 * Splits `total` by `weights` (bps): every entry gets floor(total × w / 10000) and the rounding
 * remainder (0..n−1 cents) goes to the entry with the largest weight (tie: the first one).
 *
 * Invariants: Σ result === total; result[i] ≥ 0.
 * @throws InvalidWeightsError if Σ weights !== 10000, a weight is out of range, or total < 0.
 * @throws InvalidMoneyError if total is not a safe integer.
 */
export function allocateByWeights(total: Cents, weights: readonly BasisPoints[]): Cents[] {
  if (!Number.isSafeInteger(total)) {
    throw new InvalidMoneyError(`Amount must be a safe integer number of cents, got ${total}`);
  }
  if (total < 0) throw new InvalidWeightsError(`Cannot split a negative amount (${total})`);

  let weightSum = 0;
  let largest = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] as number;
    if (!Number.isInteger(w) || w < 0 || w > BPS_TOTAL) {
      throw new InvalidWeightsError(`Weight at ${i} must be an integer 0–${BPS_TOTAL}, got ${w}`);
    }
    weightSum += w;
    if (largest === -1 || w > (weights[largest] as number)) largest = i;
  }
  if (weightSum !== BPS_TOTAL) {
    throw new InvalidWeightsError(`Weights must sum to ${BPS_TOTAL} bps, got ${weightSum}`);
  }

  const parts = weights.map((w) => floorShare(total, w));
  const assigned = parts.reduce((a, b) => a + b, 0);
  parts[largest] = (parts[largest] as number) + (total - assigned);
  return parts.map((p) => p as Cents);
}
