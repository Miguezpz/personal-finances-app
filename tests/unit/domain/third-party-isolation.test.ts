/**
 * T096 · Third-party MSI charges never touch personal metrics (US5-5, FR-020, SC-007), and
 * collecting an installment doesn't add to the Safe-to-Spend (US5-6 / clarification 5, FR-026a).
 *
 * The isolation is structural: a purchase for someone else is a Receivable + Installments, never an
 * Expense, and the personal calculations only read allocations / expenses / recurring / goals.
 */
import { describe, expect, it } from "vitest";
import { generateDemoSnapshot } from "@/data/mock/seed";
import { cents } from "@/domain/money";
import { periodOf } from "@/domain/periods";
import { computeCarryChain, computeSafeToSpend } from "@/domain/safe-to-spend";
import type { FinanceSnapshot, IsoDate } from "@/domain/types";
import { d, makeInstallment, makeReceivable, testId } from "../../utils/fixtures";

const today = d("2026-11-12") as IsoDate;

function personalMetrics(s: FinanceSnapshot) {
  const input = { ...s, today, period: periodOf(today) };
  return {
    safeToSpend: computeSafeToSpend(input),
    chain: [...computeCarryChain(input, periodOf(today).key).entries()],
  };
}

describe("third-party isolation", () => {
  const base = generateDemoSnapshot({ today });
  const withoutThirdParty: FinanceSnapshot = { ...base, receivables: [], installments: [] };

  it("registering MSI purchases for others leaves Safe-to-Spend and the carry chain identical", () => {
    const debtorId = testId();
    const big = makeReceivable({
      debtorId,
      cardAccountId: base.accounts[1]!.id,
      total: cents(5_000_000),
      termMonths: 12,
    });
    const installments = Array.from({ length: 12 }, (_, k) =>
      makeInstallment({
        receivableId: big.id,
        seq: k + 1,
        amount: cents(416_666 + (k === 11 ? 8 : 0)),
      }),
    );
    const withMore = {
      ...base,
      receivables: [...base.receivables, big],
      installments: [...base.installments, ...installments],
    };
    expect(personalMetrics(withMore)).toEqual(personalMetrics(withoutThirdParty));
    expect(personalMetrics(base)).toEqual(personalMetrics(withoutThirdParty));
  });

  it("collecting an installment doesn't change the Safe-to-Spend (US5-6)", () => {
    const pending = base.installments.find((i) => i.status !== "collected");
    if (!pending) throw new Error("demo has no pending installment");
    const collected: FinanceSnapshot = {
      ...base,
      installments: base.installments.map((i) =>
        i.id === pending.id
          ? { ...i, collected: i.amount, collectedOn: today, status: "collected" as const }
          : i,
      ),
    };
    expect(personalMetrics(collected)).toEqual(personalMetrics(base));
  });
});
