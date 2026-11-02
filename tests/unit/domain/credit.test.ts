/**
 * T087 · Card status (FR-013a/b, FR-029, US4-4/5, US10-1a).
 *
 *   totalDebt          = Σ purchases with the card + Σ full MSI totals on the card − Σ payments  (≥ 0)
 *   payToAvoidInterest = Σ purchases dated ≤ last cut-off
 *                      + Σ MSI installments billed up to this statement (cardDueOn ≤ its due date)
 *                      − Σ payments                                                          (≥ 0)
 * The contract's formula subtracted only payments AFTER the cut-off; with history that re-counts
 * statements already paid before it. The cumulative form is equal on a fresh card (US10-1a) and
 * stays right over months — see "pays each statement in full".
 */
import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { cardStatus } from "@/domain/credit";
import type { Expense, Receivable } from "@/domain/types";
import {
  d,
  makeCard,
  makeCardPayment,
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
const pay = (amount: number, on: string) =>
  makeCardPayment({ cardAccountId: card.id, amount: cents(amount), paidOn: d(on) });

const empty = {
  expenses: [] as Expense[],
  cardPayments: [],
  receivables: [] as Receivable[],
  installments: [],
};

describe("cardStatus · dates", () => {
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
  it("US4-4: a $500 purchase raises the debt; US4-5: its payment lowers it", () => {
    const today = d("2026-11-20");
    const before = cardStatus(card, empty, today);
    const bought = cardStatus(card, { ...empty, expenses: [buy(50_000, "2026-11-15")] }, today);
    const paid = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(50_000, "2026-11-15")],
        cardPayments: [pay(50_000, "2026-11-20")],
      },
      today,
    );
    expect(before.totalDebt).toBe(0);
    expect(bought.totalDebt).toBe(50_000);
    expect(paid.totalDebt).toBe(0);
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
        cardPayments: [],
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
      cardPayments: [pay(100_000, "2026-09-28"), pay(50_000, "2026-10-28")],
    };
    // Nov 15: statement Nov 10 holds the Nov 2 purchase only; the older ones were paid.
    const s = cardStatus(card, history, d("2026-11-15"));
    expect(s.payToAvoidInterest).toBe(70_000);
    expect(s.totalDebt).toBe(70_000);
  });

  it("payments after the cut-off reduce what's left to pay, never below 0", () => {
    const s = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(100_000, "2026-11-05")],
        cardPayments: [pay(30_000, "2026-11-12")],
      },
      d("2026-11-15"),
    );
    expect(s.payToAvoidInterest).toBe(70_000);
    const over = cardStatus(
      card,
      {
        ...empty,
        expenses: [buy(100_000, "2026-11-05")],
        cardPayments: [pay(150_000, "2026-11-12")],
      },
      d("2026-11-15"),
    );
    expect(over.payToAvoidInterest).toBe(0);
    expect(over.totalDebt).toBe(0);
  });

  it("ignores other cards' purchases, payments and MSI", () => {
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
        cardPayments: [
          makeCardPayment({ cardAccountId: other.id, amount: cents(1), paidOn: d("2026-11-12") }),
        ],
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
        cardPayments: [pay(10_000, "2026-10-29")],
      },
      d("2026-11-03"),
    );
    expect(paid.overdue).toBe(false);
  });

  it("rejects an account that isn't a configured credit card", () => {
    expect(() => cardStatus(makeCard({ cutOffDay: null }), empty, d("2026-11-15"))).toThrow();
  });
});
