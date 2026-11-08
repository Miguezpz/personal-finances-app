/**
 * Spec 011 · FR-018: an amount-based card payment from before spec 011 marks the statement it was
 * paying — the latest cut-off strictly before the payment date. Migration 0011 uses the same rule.
 */
import { describe, expect, it } from "vitest";
import { cardStatementSummary, statementOf } from "@/domain/credit";
import { markForLegacyPayment } from "@/domain/legacy-card-payments";
import { cents } from "@/domain/money";
import { d, emptySnapshot, makeCard, makeExpense, makeMark } from "../../utils/fixtures";

describe("markForLegacyPayment", () => {
  it.each([
    [10, "2026-11-12", "2026-11-10"], // paid two days after the cut-off → that statement
    [10, "2026-11-10", "2026-10-10"], // paid on the cut-off day → the previous statement
    [10, "2026-11-30", "2026-11-10"], // paid on the due date
    [31, "2026-03-05", "2026-02-28"], // cut-off on the 31st falls on Feb 28
    [10, "2027-01-01", "2026-12-10"], // crosses the year
  ])("cut-off day %d, paid on %s → statement of %s", (day, paidOn, expected) => {
    expect(markForLegacyPayment(day, d(paidOn))).toBe(expected);
  });
});

describe("converting an old payment history (FR-019, SC-004)", () => {
  // Card: cut-off on the 10th + 20 days. Three old payments; the October one over-paid by $500.
  const card = makeCard({ cutOffDay: 10, paymentDueOffsetDays: 20 });
  const buy = (amount: number, on: string) =>
    makeExpense({ amount: cents(amount), spentOn: d(on), paymentAccountId: card.id });
  const oldPayments = [
    { paidOn: "2026-09-28", amount: 100_000 },
    { paidOn: "2026-10-27", amount: 100_000 }, // only $50,000 was recorded: $50,000 "excess"
    { paidOn: "2026-10-29", amount: 10 }, // a second payment on the same statement
  ];
  const marks = [
    ...new Set(oldPayments.map((p) => markForLegacyPayment(card.cutOffDay as number, d(p.paidOn)))),
  ].map((cutOff) => makeMark({ cardAccountId: card.id, cutOff }));

  it("each statement those payments covered is paid, once", () => {
    expect(marks.map((m) => m.cutOff)).toEqual(["2026-09-10", "2026-10-10"]);
  });

  it("the old excess doesn't cover the next statement", () => {
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(100_000, "2026-09-05"), buy(50_000, "2026-10-01"), buy(70_000, "2026-11-02")],
      statementMarks: marks,
    });
    const s = cardStatementSummary(card, data, d("2026-11-15"));
    expect(s.last).toMatchObject({ cutOff: "2026-11-10", state: "pending", outstanding: 70_000 });
    expect(statementOf(card, data, d("2026-10-10"), d("2026-11-15")).state).toBe("paid");
  });
});
