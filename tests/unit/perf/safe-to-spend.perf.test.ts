/**
 * T149 · Performance goal (plan.md): Safe-to-Spend recalculated in < 50 ms with 5 years of
 * history (≈ 10 thousand movements). Best of several runs after a warm-up, so a busy CI machine
 * doesn't produce false alarms while a real regression (e.g. quadratic work) still fails.
 */
import { describe, expect, it } from "vitest";
import { generateHistory, HISTORY_TODAY } from "@/data/mock/seed";
import { periodOf } from "@/domain/periods";
import { computeSafeToSpend } from "@/domain/safe-to-spend";

export function bestOf(runs: number, fn: () => void): number {
  fn(); // warm-up (JIT)
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

describe("computeSafeToSpend · 5 years of history", () => {
  const s = generateHistory(5);
  const movements =
    s.expenses.length + s.incomes.length + s.allocations.length + s.contributions.length;

  it("has the volume the goal talks about (≈ 10 thousand movements)", () => {
    expect(movements).toBeGreaterThanOrEqual(9_000);
  });

  it("recalculates in under 50 ms", () => {
    const ms = bestOf(5, () =>
      computeSafeToSpend({
        period: periodOf(HISTORY_TODAY),
        today: HISTORY_TODAY,
        settings: s.settings,
        allocations: s.allocations,
        expenses: s.expenses,
        recurring: s.recurring,
        goals: s.goals,
        contributions: s.contributions,
      }),
    );
    expect(ms).toBeLessThan(50);
  });
});
