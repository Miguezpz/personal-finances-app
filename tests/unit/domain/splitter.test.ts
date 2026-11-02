/**
 * T056 · Income splitter (US1, FR-001…FR-005): exact sums, investment sub-rules, missing rule,
 * effective rule by date, and the effective date of a newly saved rule.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RuleNotConfiguredError, InvalidWeightsError } from "@/domain/errors";
import { bps, cents } from "@/domain/money";
import { effectiveRule, nextRuleEffectiveDate, splitIncome } from "@/domain/splitter";
import type { BasisPoints, DistributionRule, IsoDate, Uuid } from "@/domain/types";
import { d, makeIncome, makeRule, testId } from "../../utils/fixtures";

const STOCKS = "00000000-0000-4000-8000-0000000000a1" as Uuid;
const SOFIPOS = "00000000-0000-4000-8000-0000000000a2" as Uuid;

const rule503020 = makeRule({
  effectiveFrom: d("2026-01-01"),
  needs: bps(5000),
  wants: bps(3000),
  investment: bps(2000),
  investmentSubrules: [
    { accountId: STOCKS, pct: bps(9000) },
    { accountId: SOFIPOS, pct: bps(1000) },
  ],
});

const amountOf = (
  r: ReturnType<typeof splitIncome>,
  bucket: string,
  accountId: Uuid | null = null,
) => r.allocations.find((a) => a.bucket === bucket && a.accountId === accountId)?.amount;

describe("splitIncome", () => {
  it("splits $20,000 as 10,000 / 6,000 / 4,000 and investment as 3,600 / 400 (US1-1, US1-2)", () => {
    const r = splitIncome(cents(2_000_000), rule503020, d("2026-11-16"));
    expect(amountOf(r, "needs")).toBe(1_000_000);
    expect(amountOf(r, "wants")).toBe(600_000);
    expect(amountOf(r, "investment", STOCKS)).toBe(360_000);
    expect(amountOf(r, "investment", SOFIPOS)).toBe(40_000);
    expect(r.allocations).toHaveLength(4);
    expect(r.total).toBe(2_000_000);
    expect(r.allocations.every((a) => a.periodStart === "2026-11-16")).toBe(true);
  });

  it("gives the cents remainder to the largest bucket, deterministically (US1-4)", () => {
    // 100.01 MXN at 50/30/20 → floors 5000, 3000, 2000 cents… + 1 cent remainder → Needs.
    const r = splitIncome(cents(10_001), rule503020, d("2026-11-16"));
    expect(amountOf(r, "needs")).toBe(5001);
    expect(amountOf(r, "wants")).toBe(3000);
    // Investment 2000 cents split 90/10.
    expect(amountOf(r, "investment", STOCKS)).toBe(1800);
    expect(amountOf(r, "investment", SOFIPOS)).toBe(200);
  });

  it("emits no investment rows when the investment share is 0", () => {
    const r = splitIncome(
      cents(100_000),
      makeRule({ needs: bps(6000), wants: bps(4000), investment: bps(0), investmentSubrules: [] }),
      d("2026-11-01"),
    );
    expect(r.allocations.map((a) => a.bucket)).toEqual(["needs", "wants"]);
  });

  it("keeps a 0% bucket as a $0 allocation (edge case: bucket at 0%)", () => {
    const r = splitIncome(
      cents(100_000),
      makeRule({
        needs: bps(10_000),
        wants: bps(0),
        investment: bps(0),
        investmentSubrules: [],
      }),
      d("2026-11-01"),
    );
    expect(amountOf(r, "wants")).toBe(0);
    expect(amountOf(r, "needs")).toBe(100_000);
  });

  it("throws RuleNotConfiguredError without a rule", () => {
    expect(() => splitIncome(cents(100), null, d("2026-11-01"))).toThrow(RuleNotConfiguredError);
  });

  it("rejects investment > 0 without sub-rules summing 10000", () => {
    const broken = makeRule({ investmentSubrules: [{ accountId: STOCKS, pct: bps(5000) }] });
    expect(() => splitIncome(cents(100), broken, d("2026-11-01"))).toThrow(InvalidWeightsError);
  });

  it("rejects a funded period start that isn't day 1 or 16", () => {
    expect(() => splitIncome(cents(100), rule503020, d("2026-11-15"))).toThrow();
  });

  it("property: Σ allocations === amount for any amount and any valid rule (SC-001)", () => {
    const pctArb = fc
      .tuple(fc.integer({ min: 0, max: 10_000 }), fc.integer({ min: 0, max: 10_000 }))
      .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const)
      .map(
        ([a, b]) =>
          [a, b - a, 10_000 - b].map((x) => bps(x)) as [BasisPoints, BasisPoints, BasisPoints],
      );
    const subArb = fc
      .integer({ min: 1, max: 9_999 })
      .map((x) => [bps(x), bps(10_000 - x)] as const);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9_000_000_000_000 }),
        pctArb,
        subArb,
        (amount, [n, w, i], [s1, s2]) => {
          const rule: DistributionRule = makeRule({
            needs: n,
            wants: w,
            investment: i,
            investmentSubrules:
              i > 0
                ? [
                    { accountId: STOCKS, pct: s1 },
                    { accountId: SOFIPOS, pct: s2 },
                  ]
                : [],
          });
          const r = splitIncome(cents(amount), rule, d("2026-11-16"));
          expect(r.allocations.reduce((s, a) => s + a.amount, 0)).toBe(amount);
          expect(r.allocations.every((a) => a.amount >= 0)).toBe(true);
          expect(
            r.allocations.every((a) => (a.bucket === "investment") === (a.accountId !== null)),
          ).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("effectiveRule", () => {
  const r1 = makeRule({ effectiveFrom: d("2026-01-01") });
  const r2 = makeRule({ effectiveFrom: d("2026-06-01") });
  const r3 = makeRule({ effectiveFrom: d("2026-11-16") });

  it("picks the rule with the greatest effectiveFrom ≤ date, regardless of order", () => {
    expect(effectiveRule([r3, r1, r2], d("2026-06-01"))).toBe(r2);
    expect(effectiveRule([r3, r1, r2], d("2026-11-15"))).toBe(r2);
    expect(effectiveRule([r3, r1, r2], d("2026-11-16"))).toBe(r3);
  });

  it("returns null before the first rule or without rules", () => {
    expect(effectiveRule([r1], d("2025-12-31"))).toBeNull();
    expect(effectiveRule([], d("2026-11-01"))).toBeNull();
  });
});

describe("nextRuleEffectiveDate (FR-005 + same-day edge case)", () => {
  const today = d("2026-11-15") as IsoDate;

  it("is today when no rule starts today", () => {
    expect(nextRuleEffectiveDate([makeRule({ effectiveFrom: d("2026-01-01") })], [], today)).toBe(
      today,
    );
  });

  it("is today when today's rule has no incomes yet (it gets overwritten)", () => {
    const todays = makeRule({ effectiveFrom: today });
    expect(nextRuleEffectiveDate([todays], [makeIncome({ ruleId: testId() })], today)).toBe(today);
  });

  it("is tomorrow when today's rule was already used by an income", () => {
    const todays = makeRule({ effectiveFrom: today });
    expect(nextRuleEffectiveDate([todays], [makeIncome({ ruleId: todays.id })], today)).toBe(
      "2026-11-16",
    );
  });
});
