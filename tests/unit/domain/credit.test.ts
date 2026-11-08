/**
 * T087 · Card status (FR-013a/b, FR-029, US4-4/5, US10-1a), with spec 011's "paid through" marks:
 *
 *   L                  = latest marked cut-off of the card (null = never marked)
 *   payToAvoidInterest = Σ purchases with L < spentOn ≤ last cut-off
 *                      + Σ MSI installments with due(L) < cardDueOn ≤ due(last cut-off)   (0 if paid)
 *   totalDebt          = Σ purchases after L + Σ MSI installments with cardDueOn > due(L)
 * There are no payment amounts, so nothing can be over-paid.
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { cardStatus } from "@/domain/credit";
import type { Expense, Receivable } from "@/domain/types";
import {
  d,
  makeCard,
  makeMark,
  makeExpense,
  makeInstallment,
  makeReceivable,
} from "../../utils/fixtures";

// Cut-off on the 10th, payment due 20 days later (the 30th or so).
const card = makeCard({ cutOffDay: 10, paymentDueOffsetDays: 20 });
const buy = (amount: number, on: string): Expense =>
  makeExpense({
    amount: cents(amount),
    spentOn: d(on),
    paymentAccountId: card.id,
    bucket: "wants",
  });
/** "Ya la pagué" on the statement that closed on `cutOff`. */
const mark = (cutOff: string) => makeMark({ cardAccountId: card.id, cutOff: d(cutOff) });

const empty = {
  expenses: [] as Expense[],
  statementMarks: [],
  receivables: [] as Receivable[],
  installments: [],
};

describe("cardStatus · dates", () => {
  it("uses the due date moved back to a business day for 'overdue' (spec 007, US2-3)", () => {
    // Nu: cut-off Sep 23 + 11 = Sun Oct 4 → Fri Oct 2.
    const nu = makeCard({ cutOffDay: 23, paymentDueOffsetDays: 11 });
    const data = {
      ...empty,
      expenses: [
        makeExpense({
          amount: cents(1_000),
          spentOn: d("2026-09-20"),
          paymentAccountId: nu.id,
          bucket: "wants",
        }),
      ],
    };
    expect(cardStatus(nu, data, d("2026-10-02"))).toMatchObject({
      nextPaymentDue: "2026-10-02",
      overdue: false,
    });
    expect(cardStatus(nu, data, d("2026-10-03")).overdue).toBe(true);
  });

  it("last cut-off is the latest cut-off on or before today; due = cut-off + offset", () => {
    expect(cardStatus(card, empty, d("2026-11-12"))).toMatchObject({
      lastCutOff: "2026-11-10",
      nextPaymentDue: "2026-11-30",
    });
    expect(cardStatus(card, empty, d("2026-11-10")).lastCutOff).toBe("2026-11-10");
    expect(cardStatus(card, empty, d("2026-11-09"))).toMatchObject({
      lastCutOff: "2026-10-10",
      nextPaymentDue: "2026-10-30",
    });
  });

  it("clamps the cut-off day in short months and crosses years", () => {
    const eom = makeCard({ cutOffDay: 31, paymentDueOffsetDays: 10 });
    expect(cardStatus(eom, empty, d("2026-02-28")).lastCutOff).toBe("2026-02-28");
    expect(cardStatus(eom, empty, d("2026-03-15")).lastCutOff).toBe("2026-02-28");
    expect(cardStatus(card, empty, d("2027-01-05"))).toMatchObject({
      lastCutOff: "2026-12-10",
      nextPaymentDue: "2026-12-30",
    });
  });
});

describe("cardStatus · debt and pay-to-avoid-interest", () => {
  it("US4-4: a $500 purchase raises the debt; marking its statement as paid settles it", () => {
    const today = d("2026-12-15");
    const before = cardStatus(card, empty, today);
    const bought = cardStatus(card, { ...empty, expenses: [buy(50_000, "2026-11-15")] }, today);
    const paid = cardStatus(
      card,
      { ...empty, expenses: [buy(50_000, "2026-11-15")], statementMarks: [mark("2026-12-10")] },
      today,
    );
    expect(before.totalDebt).toBe(0);
    expect(bought.totalDebt).toBe(50_000);
    expect(paid).toMatchObject({ totalDebt: 0, payToAvoidInterest: 0, overdue: false });
  });

  it("only purchases up to the last cut-off are due for this statement", () => {
    const s = cardStatus(
      card,
      { ...empty, expenses: [buy(100_000, "2026-11-08"), buy(40_000, "2026-11-11")] },
      d("2026-11-15"),
    );
    expect(s.payToAvoidInterest).toBe(100_000); // the Nov 11 purchase goes to the next statement
    expect(s.totalDebt).toBe(140_000);
  });

  it("US10-1a: $3,000 of purchases + a $12,000 MSI at 6 months → pay $5,000; debt includes the other $10,000", () => {
    const msi = makeReceivable({
      cardAccountId: card.id,
      total: cents(1_200_000),
      termMonths: 6,
      purchaseDate: d("2026-10-05"),
    });
    const installments = Array.from({ length: 6 }, (_, i) =>
      makeInstallment({
        receivableId: msi.id,
        seq: i + 1,
        amount: cents(200_000),
        // Statement Oct 10 → due Oct 30, then one per month.
        cardDueOn: d(
          ["2026-10-30", "2026-11-30", "2026-12-30", "2027-01-30", "2027-03-02", "2027-03-30"][
            i
          ] as string,
        ),
        dueOn: d("2026-10-27"),
      }),
    );
    const s = cardStatus(
      card,
      {
        expenses: [buy(300_000, "2026-10-08")],
        statementMarks: [],
        receivables: [msi],
        installments,
      },
      d("2026-10-15"),
    );
    expect(s.payToAvoidInterest).toBe(500_000);
    expect(s.totalDebt).toBe(1_500_000); // 3,000 + 12,000 (full MSI)
  });

  it("pays each statement in full across months without re-counting old ones", () => {
    const history = {
      ...empty,
      expenses: [buy(100_000, "2026-09-05"), buy(50_000, "2026-10-01"), buy(70_000, "2026-11-02")],
      statementMarks: [mark("2026-09-10"), mark("2026-10-10")],
    };
    // Nov 15: statement Nov 10 holds the Nov 2 purchase only; the older ones were marked paid.
    const s = cardStatus(card, history, d("2026-11-15"));
    expect(s.payToAvoidInterest).toBe(70_000);
    expect(s.totalDebt).toBe(70_000);
  });

  it("marking the latest statement settles earlier unmarked ones too (FR-004)", () => {
    const s = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(100_000, "2026-09-05"), buy(50_000, "2026-10-01")],
        statementMarks: [mark("2026-10-10")],
      },
      d("2026-10-20"),
    );
    expect(s).toMatchObject({ payToAvoidInterest: 0, totalDebt: 0 });
  });

  it("an unpaid earlier statement rolls into the next one until a statement is marked", () => {
    const s = cardStatus(
      card,
      { ...empty, expenses: [buy(100_000, "2026-09-05"), buy(50_000, "2026-10-01")] },
      d("2026-10-20"),
    );
    expect(s.payToAvoidInterest).toBe(150_000);
  });

  it("a purchase recorded late inside a paid statement stays covered (no reopening)", () => {
    const s = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(40_000, "2026-11-08"), buy(10_000, "2026-11-12")],
        statementMarks: [mark("2026-11-10")],
      },
      d("2026-11-15"),
    );
    expect(s).toMatchObject({ payToAvoidInterest: 0, totalDebt: 10_000 });
  });

  it("a mark whose date no longer matches a cut-off (terms changed) still covers up to its date", () => {
    // The card used to close on the 5th; now it closes on the 10th.
    const s = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(30_000, "2026-11-04"), buy(20_000, "2026-11-07")],
        statementMarks: [mark("2026-11-05")],
      },
      d("2026-11-12"),
    );
    expect(s.payToAvoidInterest).toBe(20_000);
  });

  it("MSI installments billed up to a marked statement are covered", () => {
    const msi = makeReceivable({ cardAccountId: card.id, total: cents(300_000) });
    const installments = ["2026-10-30", "2026-11-30", "2026-12-30"].map((due, i) =>
      makeInstallment({
        receivableId: msi.id,
        seq: i + 1,
        amount: cents(100_000),
        cardDueOn: d(due),
      }),
    );
    const s = cardStatus(
      card,
      {
        expenses: [],
        statementMarks: [mark("2026-10-10")],
        receivables: [msi],
        installments,
      },
      d("2026-11-15"),
    );
    expect(s.payToAvoidInterest).toBe(100_000); // the Nov 30 installment
    expect(s.totalDebt).toBe(200_000); // Nov 30 + Dec 30
  });

  it("ignores other cards' purchases, marks and MSI", () => {
    const other = makeCard();
    const s = cardStatus(
      card,
      {
        expenses: [
          makeExpense({
            amount: cents(99_999),
            spentOn: d("2026-11-01"),
            paymentAccountId: other.id,
          }),
        ],
        statementMarks: [makeMark({ cardAccountId: other.id, cutOff: d("2026-11-10") })],
        receivables: [makeReceivable({ cardAccountId: other.id })],
        installments: [],
      },
      d("2026-11-15"),
    );
    expect(s).toMatchObject({ totalDebt: 0, payToAvoidInterest: 0 });
  });

  it("flags an unpaid statement past its due date as overdue", () => {
    const s = cardStatus(
      card,
      { ...empty, expenses: [buy(10_000, "2026-10-05")] },
      d("2026-11-03"),
    );
    expect(s).toMatchObject({
      lastCutOff: "2026-10-10",
      nextPaymentDue: "2026-10-30",
      overdue: true,
    });
    const paid = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(10_000, "2026-10-05")],
        statementMarks: [mark("2026-10-10")],
      },
      d("2026-11-03"),
    );
    expect(paid.overdue).toBe(false);
  });

  it("rejects an account that isn't a configured credit card", () => {
    expect(() => cardStatus(makeCard({ cutOffDay: null }), empty, d("2026-11-15"))).toThrow();
  });
});
