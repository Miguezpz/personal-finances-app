/**
 * Spec 008 · US3: one statement summary for Credit and Expenses (research.md R4).
 * Gold Card case: the last statement (due Oct 30) is paid; purchases after its cut-off make the
 * next one (due Nov 30) the headline — Expenses and Credit used to disagree on it.
 */
import { describe, expect, it } from "vitest";
import { cardStatementSummary, creditTimeline } from "@/domain/credit";
import { cents } from "@/domain/money";
import type { Expense } from "@/domain/types";
import {
  d,
  emptySnapshot,
  makeCard,
  makeCardPayment,
  makeExpense,
  makeInstallment,
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
const pay = (amount: number, on: string) =>
  makeCardPayment({ cardAccountId: card.id, amount: cents(amount), paidOn: d(on) });
const TODAY = d("2026-11-07");

describe("cardStatementSummary", () => {
  it("paid last statement → the next one leads (Gold Card)", () => {
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(5_000, "2026-10-01"), buy(1_319_050, "2026-10-20")],
      cardPayments: [pay(5_000, "2026-10-25")],
    });
    const s = cardStatementSummary(card, data, TODAY);
    expect(s.last).toEqual({
      cutOff: "2026-10-10",
      due: "2026-10-30",
      outstanding: cents(0),
      state: "paid",
    });
    expect(s.next).toEqual({ cutOff: "2026-11-10", due: "2026-11-30", amount: cents(1_319_050) });
    expect(s.headline).toBe("next");
    expect(s.payAmount).toBe(cents(1_319_050));
  });

  it("matches the timeline's next card_due amount and date", () => {
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(5_000, "2026-10-01"), buy(1_319_050, "2026-10-20")],
      cardPayments: [pay(5_000, "2026-10-25")],
    });
    const s = cardStatementSummary(card, data, TODAY);
    const due = creditTimeline(data, TODAY, d("2027-01-05")).find((e) => e.kind === "card_due");
    expect(due).toMatchObject({ date: s.next.due, amount: s.next.amount });
  });

  it("unpaid and not yet due → pending, the last one leads", () => {
    const data = emptySnapshot({ accounts: [card], expenses: [buy(800, "2026-11-02")] });
    const s = cardStatementSummary(card, data, d("2026-11-15"));
    expect(s.last).toMatchObject({
      cutOff: "2026-11-10",
      state: "pending",
      outstanding: cents(800),
    });
    expect(s.headline).toBe("last");
    expect(s.payAmount).toBe(cents(800));
  });

  it("unpaid after its due date → overdue", () => {
    const data = emptySnapshot({ accounts: [card], expenses: [buy(800, "2026-10-02")] });
    const s = cardStatementSummary(card, data, TODAY);
    expect(s.last.state).toBe("overdue");
    expect(s.headline).toBe("last");
  });

  it("partly paid → pending with the remainder", () => {
    const data = emptySnapshot({
      accounts: [card],
      expenses: [buy(1_000, "2026-11-01")],
      cardPayments: [pay(400, "2026-11-12")],
    });
    const s = cardStatementSummary(card, data, d("2026-11-15"));
    expect(s.last).toMatchObject({ state: "pending", outstanding: cents(600) });
  });

  it("no activity → paid, next $0", () => {
    const s = cardStatementSummary(card, emptySnapshot({ accounts: [card] }), TODAY);
    expect(s.last.state).toBe("paid");
    expect(s.next.amount).toBe(cents(0));
    expect(s.payAmount).toBe(cents(0));
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
    expect(s.totalDebt).toBe(cents(3_000));
  });
});
