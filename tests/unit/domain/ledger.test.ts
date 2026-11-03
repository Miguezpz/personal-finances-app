/**
 * T119 · Unified ledger (FR-012, FR-027, FR-042): incomes (+), expenses and recurring charges (−),
 * card payments (−) and third-party collections (+, isThirdParty), newest first; filters by date,
 * type, account, bucket, subcategory and third party.
 */
import { describe, expect, it } from "vitest";
import { buildLedger, filterLedger } from "@/domain/ledger";
import { cents } from "@/domain/money";
import {
  d,
  emptySnapshot,
  makeCardPayment,
  makeExpense,
  makeIncome,
  makeInstallment,
  makeReceivable,
  testId,
} from "../../utils/fixtures";

const card = testId();
const debit = testId();
const groceries = testId();

const income = makeIncome({
  label: "Salary",
  amount: cents(2_000_000),
  receivedOn: d("2026-11-15"),
  depositAccountId: debit,
});
const manual = makeExpense({
  amount: cents(50_000),
  spentOn: d("2026-11-03"),
  bucket: "needs",
  subcategoryId: groceries,
  paymentAccountId: card,
  note: "Weekly groceries",
});
const rent = makeExpense({
  amount: cents(800_000),
  spentOn: d("2026-11-01"),
  bucket: "needs",
  origin: "recurring",
  recurringExpenseId: testId(),
  occurrenceDate: d("2026-11-01"),
  paymentAccountId: debit,
  note: "Rent",
});
const payment = makeCardPayment({
  cardAccountId: card,
  amount: cents(30_000),
  paidOn: d("2026-11-10"),
  note: null,
});
const receivable = makeReceivable({ description: "Phone", cardAccountId: card });
const collected = makeInstallment({
  receivableId: receivable.id,
  amount: cents(200_000),
  collected: cents(200_000),
  collectedOn: d("2026-11-12"),
  status: "collected",
});
const pending = makeInstallment({ receivableId: receivable.id, seq: 2, amount: cents(200_000) });

const snapshot = emptySnapshot({
  incomes: [income],
  expenses: [manual, rent],
  cardPayments: [payment],
  receivables: [receivable],
  installments: [collected, pending],
});

describe("buildLedger", () => {
  const ledger = buildLedger(snapshot);

  it("unifies every movement with signed MXN amounts, newest first", () => {
    expect(ledger.map((e) => [e.type, e.occurredOn, e.amount])).toEqual([
      ["income", "2026-11-15", 2_000_000],
      ["installment_collection", "2026-11-12", 200_000],
      ["card_payment", "2026-11-10", -30_000],
      ["expense", "2026-11-03", -50_000],
      ["recurring_expense", "2026-11-01", -800_000],
    ]);
  });

  it("keeps description, account, bucket and subcategory", () => {
    const expense = ledger.find((e) => e.type === "expense");
    expect(expense).toMatchObject({
      description: "Weekly groceries",
      accountId: card,
      bucket: "needs",
      subcategoryId: groceries,
      isThirdParty: false,
    });
    expect(ledger.find((e) => e.type === "income")).toMatchObject({
      description: "Salary",
      accountId: debit,
      subcategoryId: null,
    });
  });

  it("flags third-party collections and leaves uncollected installments out", () => {
    const thirdParty = ledger.filter((e) => e.isThirdParty);
    expect(thirdParty).toHaveLength(1);
    expect(thirdParty[0]).toMatchObject({ description: "Phone", accountId: card, amount: 200_000 });
  });

  it("labels recurring charges as automatic (their own type, FR-012)", () => {
    expect(ledger.find((e) => e.type === "recurring_expense")).toMatchObject({
      description: "Rent",
    });
  });
});

describe("filterLedger", () => {
  const ledger = buildLedger(snapshot);
  const types = (f: Parameters<typeof filterLedger>[1]) =>
    filterLedger(ledger, f).map((e) => e.type);

  it("filters by inclusive date range", () => {
    expect(types({ from: d("2026-11-03"), to: d("2026-11-12") })).toEqual([
      "installment_collection",
      "card_payment",
      "expense",
    ]);
  });

  it("filters by type", () => {
    expect(types({ types: ["expense", "recurring_expense"] })).toEqual([
      "expense",
      "recurring_expense",
    ]);
  });

  it("filters by account", () => {
    expect(types({ accountId: debit })).toEqual(["income", "recurring_expense"]);
  });

  it("filters by bucket and by subcategory", () => {
    expect(types({ bucket: "needs" })).toEqual(["expense", "recurring_expense"]);
    expect(types({ subcategoryIds: [groceries] })).toEqual(["expense"]);
  });

  it("shows only, or hides, third-party movements", () => {
    expect(types({ thirdParty: true })).toEqual(["installment_collection"]);
    expect(types({ thirdParty: false })).not.toContain("installment_collection");
  });

  it("combines filters, and an empty filter returns everything", () => {
    expect(types({ accountId: card, from: d("2026-11-04") })).toEqual([
      "installment_collection",
      "card_payment",
    ]);
    expect(filterLedger(ledger, {})).toHaveLength(ledger.length);
  });
});
