import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { InvalidMoneyError, InvalidWeightsError } from "@/domain/errors";
import {
  addCents,
  allocateByWeights,
  bps,
  cents,
  negateCents,
  subCents,
  sumCents,
} from "@/domain/money";
import type { BasisPoints, Cents } from "@/domain/types";

/** Arbitrary list of 1..6 integer weights in bps that sum to exactly 10000. */
const weightsArb = fc
  .array(fc.integer({ min: 0, max: 10_000 }), { minLength: 0, maxLength: 5 })
  .map((cuts) => {
    const sorted = [0, ...cuts.sort((a, b) => a - b), 10_000];
    return sorted.slice(1).map((v, i) => v - (sorted[i] as number));
  })
  .map((ws) => ws.map((w) => bps(w)));

/** Totals up to ~$90 billion MXN in cents, well inside Number.MAX_SAFE_INTEGER. */
const totalArb = fc.integer({ min: 0, max: 9_000_000_000_000 }).map((n) => cents(n));

const indexOfMax = (ws: readonly number[]) =>
  ws.reduce((best, w, i) => (w > (ws[best] as number) ? i : best), 0);

describe("cents / bps", () => {
  it("accept safe integers only", () => {
    expect(cents(0)).toBe(0);
    expect(cents(-150)).toBe(-150);
    expect(() => cents(1.5)).toThrow(InvalidMoneyError);
    expect(() => cents(Number.NaN)).toThrow(InvalidMoneyError);
    expect(() => cents(Number.MAX_SAFE_INTEGER + 1)).toThrow(InvalidMoneyError);
    expect(bps(10_000)).toBe(10_000);
    expect(() => bps(10_001)).toThrow(InvalidWeightsError);
    expect(() => bps(-1)).toThrow(InvalidWeightsError);
    expect(() => bps(12.5)).toThrow(InvalidWeightsError);
  });

  it("add, subtract, negate and sum stay integral", () => {
    expect(addCents(cents(150), cents(250))).toBe(400);
    expect(subCents(cents(150), cents(250))).toBe(-100);
    expect(negateCents(cents(42))).toBe(-42);
    expect(sumCents([cents(1), cents(2), cents(3)])).toBe(6);
    expect(sumCents([])).toBe(0);
  });
});

describe("allocateByWeights", () => {
  it("splits $20,000 as 50/30/20 exactly (US1-1)", () => {
    expect(allocateByWeights(cents(2_000_000), [bps(5000), bps(3000), bps(2000)])).toEqual([
      1_000_000, 600_000, 400_000,
    ]);
  });

  it("gives the rounding remainder to the largest weight", () => {
    // 100.01 MXN at 3333/3333/3334 → floors 3333,3333,3334 = 10000; remainder 1 → largest (index 2)
    expect(allocateByWeights(cents(10_001), [bps(3333), bps(3333), bps(3334)])).toEqual([
      3333, 3333, 3335,
    ]);
  });

  it("breaks ties for the largest weight by taking the first one", () => {
    expect(allocateByWeights(cents(1), [bps(5000), bps(5000)])).toEqual([1, 0]);
    // floors 0,1,1 → remainder 1 goes to the first of the two 40% entries
    expect(allocateByWeights(cents(3), [bps(2000), bps(4000), bps(4000)])).toEqual([0, 2, 1]);
  });

  it("keeps zero-weight buckets at zero", () => {
    expect(allocateByWeights(cents(999), [bps(0), bps(10_000)])).toEqual([0, 999]);
  });

  it("property: Σ result === total, every part ≥ 0, remainder goes to the largest weight", () => {
    fc.assert(
      fc.property(totalArb, weightsArb, (total, weights) => {
        const parts = allocateByWeights(total, weights);
        expect(parts).toHaveLength(weights.length);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        for (const p of parts) {
          expect(Number.isSafeInteger(p)).toBe(true);
          expect(p).toBeGreaterThanOrEqual(0);
        }
        // Every non-max entry gets exactly floor(total × w / 10000).
        const max = indexOfMax(weights);
        weights.forEach((w, i) => {
          if (i === max) return;
          // BigInt oracle: total × w can exceed 2^53 for large totals.
          expect(parts[i]).toBe(Number((BigInt(total) * BigInt(w)) / 10_000n));
        });
      }),
      { numRuns: 500 },
    );
  });

  it("rejects weights that don't sum to 10000", () => {
    expect(() => allocateByWeights(cents(100), [bps(5000), bps(4999)])).toThrow(
      InvalidWeightsError,
    );
    expect(() => allocateByWeights(cents(100), [])).toThrow(InvalidWeightsError);
  });

  it("rejects a negative total and non-integer amounts", () => {
    expect(() => allocateByWeights(cents(-1), [bps(10_000)])).toThrow(InvalidWeightsError);
    expect(() => allocateByWeights(10.5 as Cents, [bps(10_000)])).toThrow(InvalidMoneyError);
    expect(() =>
      allocateByWeights(cents(1), [5000.5 as BasisPoints, 4999.5 as BasisPoints]),
    ).toThrow(InvalidWeightsError);
  });
});
