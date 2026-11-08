/**
 * Spec 008 · US3 + spec 011: one statement summary for Credit and Expenses, with "Ya la pagué"
 * marks instead of payment amounts. Invariants (contracts/domain.md):
 *  1. A statement covered by a mark (its own or a later one) is "paid" with nothing outstanding.
 *  2. No credit balance: marking a statement never lowers a later statement below its own charges.
 *  3. Total debt is what's recorded after the latest marked statement, never negative.
 *  4. Removing the latest own mark brings the statement back to exactly its previous state.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cardStatementSummary, creditTimeline, statementOf } from "@/domain/credit";
import { cents } from "@/domain/money";
import type { Expense, IsoDate } from "@/domain/types";
import {
  d,
  emptySnapshot,
  makeCard,
  makeExpense,
  makeInstallment,
  makeMark,
  makeReceivable,
} from "../../utils/fixtures";

// Cut-off on the 10th + 20 days: Oct 10 → Fri Oct 30; Nov 10 → Mon Nov 30.
const card = makeCard({ cutOffDay: 10, paymentDueOffsetDays: 20 });
const buy = (amount: number, on: string): Expense =>
  makeExpense({
    amount: cents(amount),
    spentOn: d(on),
    paymentAccountId: card.id,
    bucket: "wants",
  });
const mark = (cutOff: string) => makeMark({ cardAccountId: card.id, cutOff: d(cutOff) });
const TODAY = d("2026-11-07");

describe("cardStatementSummary", () => {
  it("marked last statement → paid, with its mark id; the next one leads", () => {
    const own = mark("2026-10-10");
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(5_000, "2026-10-01"), buy(1_319_050, "2026-10-20")],
      statementMarks: [own],
    });
    const s = cardStatementSummary(card, data, TODAY);
    expect(s.last).toEqual({
      cutOff: "2026-10-10",
      due: "2026-10-30",
      payRange: { from: "2026-10-11", to: "2026-10-29" },
      outstanding: cents(0),
      state: "paid",
      markId: own.id,
    });
    expect(s.next).toEqual({ cutOff: "2026-11-10", due: "2026-11-30", amount: cents(1_319_050) });
    expect(s.headline).toBe("next");
  });

  it("matches the timeline's next card_due amount and date; the marked one shows as paid", () => {
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(5_000, "2026-10-01"), buy(1_319_050, "2026-10-20")],
      statementMarks: [mark("2026-10-10")],
    });
    const s = cardStatementSummary(card, data, TODAY);
    const due = creditTimeline(data, TODAY, d("2027-01-05")).find((e) => e.kind === "card_due");
    expect(due).toMatchObject({ date: s.next.due, amount: s.next.amount, paid: false });
    const past = creditTimeline(data, d("2026-10-20"), d("2026-10-31")).find(
      (e) => e.kind === "card_due",
    );
    expect(past).toMatchObject({ date: "2026-10-30", amount: 0, paid: true });
  });

  it("unmarked and not yet due → pending, the last one leads", () => {
    const data = emptySnapshot({ accounts: [card], expenses: [buy(800, "2026-11-02")] });
    const s = cardStatementSummary(card, data, d("2026-11-15"));
    expect(s.last).toMatchObject({
      cutOff: "2026-11-10",
      state: "pending",
      outstanding: cents(800),
      markId: null,
    });
    expect(s.headline).toBe("last");
  });

  it("unmarked after its due date → overdue", () => {
    const data = emptySnapshot({ accounts: [card], expenses: [buy(800, "2026-10-02")] });
    const s = cardStatementSummary(card, data, TODAY);
    expect(s.last.state).toBe("overdue");
    expect(s.headline).toBe("last");
  });

  it("no recorded purchases → still pending until marked (the family's purchases aren't recorded)", () => {
    const s = cardStatementSummary(card, emptySnapshot({ accounts: [card] }), d("2026-11-15"));
    expect(s.last).toMatchObject({ state: "pending", outstanding: cents(0) });
    expect(s.headline).toBe("last");
    expect(cardStatementSummary(card, emptySnapshot({ accounts: [card] }), TODAY).last.state).toBe(
      "overdue",
    );
  });

  it("an earlier statement covered by a later mark is paid, without its own mark id", () => {
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(1_000, "2026-09-05")],
      statementMarks: [mark("2026-10-10")],
    });
    expect(statementOf(card, data, d("2026-09-10"), TODAY)).toMatchObject({
      state: "paid",
      markId: null,
    });
  });

  it("counts the MSI installment billed in the next statement", () => {
    const receivable = makeReceivable({ cardAccountId: card.id, total: cents(3_000) });
    const data = emptySnapshot({
      accounts: [card],
      receivables: [receivable],
      installments: [
        makeInstallment({
          receivableId: receivable.id,
          amount: cents(1_000),
          cardDueOn: d("2026-11-30"),
        }),
      ],
    });
    const s = cardStatementSummary(card, data, TODAY);
    expect(s.next.amount).toBe(cents(1_000));
    expect(s.totalDebt).toBe(cents(1_000));
  });
});

describe("invariants (fast-check)", () => {
  const CUT_OFFS = ["2026-07-10", "2026-08-10", "2026-09-10", "2026-10-10", "2026-11-10"];
  const purchase = fc.record({
    day: fc.integer({ min: 0, max: 150 }),
    amount: fc.integer({ min: 1, max: 500_000 }),
  });
  const history = fc.array(purchase, { maxLength: 25 });
  const toExpenses = (xs: { day: number; amount: number }[]) =>
    xs.map(({ day, amount }) => {
      const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
      return buy(amount, date);
    });
  const at = d("2026-11-20");

  it("no credit balance: after marking C, the next statement holds exactly its own purchases", () => {
    fc.assert(
      fc.property(history, fc.integer({ min: 0, max: 3 }), (xs, k) => {
        const expenses = toExpenses(xs);
        const marked = CUT_OFFS[k] as IsoDate;
        const next = CUT_OFFS[k + 1] as IsoDate;
        const data = emptySnapshot({ accounts: [card], expenses, statementMarks: [mark(marked)] });
        const own = expenses
          .filter((e) => e.spentOn > marked && e.spentOn <= next)
          .reduce((s, e) => s + e.amount, 0);
        const view = statementOf(card, data, next, at);
        expect(view.outstanding).toBe(own);
        expect(statementOf(card, data, marked, at).state).toBe("paid");
      }),
    );
  });

  it("total debt = purchases after the latest mark, never negative", () => {
    fc.assert(
      fc.property(history, fc.integer({ min: 0, max: 4 }), (xs, k) => {
        const expenses = toExpenses(xs);
        const marked = CUT_OFFS[k] as IsoDate;
        const data = emptySnapshot({ accounts: [card], expenses, statementMarks: [mark(marked)] });
        const after = expenses.filter((e) => e.spentOn > marked).reduce((s, e) => s + e.amount, 0);
        expect(cardStatementSummary(card, data, at).totalDebt).toBe(after);
      }),
    );
  });

  it("removing the latest own mark restores the previous state", () => {
    fc.assert(
      fc.property(history, fc.integer({ min: 0, max: 3 }), (xs, k) => {
        const expenses = toExpenses(xs);
        const earlier = k > 0 ? [mark(CUT_OFFS[k - 1] as string)] : [];
        const before = emptySnapshot({ accounts: [card], expenses, statementMarks: earlier });
        const withMark = emptySnapshot({
          accounts: [card],
          expenses,
          statementMarks: [...earlier, mark(CUT_OFFS[k] as string)],
        });
        const cut = CUT_OFFS[k] as IsoDate;
        const undone = { ...withMark, statementMarks: earlier };
        expect(statementOf(card, undone, cut, at)).toEqual(statementOf(card, before, cut, at));
      }),
    );
  });
});
