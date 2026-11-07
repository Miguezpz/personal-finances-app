import { describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import { periodFromKey } from "@/domain/periods";
import { spendingByPaymentMethod } from "@/domain/spending-by-method";
import type { PeriodKey, Uuid } from "@/domain/types";
import { d, makeAccount, makeCard, makeExpense } from "../../utils/fixtures";

const cash = makeAccount({ kind: "cash", name: "Efectivo" });
const card = makeCard({ name: "BBVA" });
const accounts = [cash, card];
const firstHalf = periodFromKey("2026-11-1" as PeriodKey);
const secondHalf = periodFromKey("2026-11-2" as PeriodKey);

describe("spendingByPaymentMethod", () => {
  it("counts only expenses inside the period, boundaries included", () => {
    const expenses = [
      makeExpense({ spentOn: d("2026-10-31"), amount: cents(100), paymentAccountId: cash.id }),
      makeExpense({ spentOn: d("2026-11-01"), amount: cents(200), paymentAccountId: cash.id }),
      makeExpense({ spentOn: d("2026-11-15"), amount: cents(300), paymentAccountId: cash.id }),
      makeExpense({ spentOn: d("2026-11-16"), amount: cents(400), paymentAccountId: cash.id }),
      makeExpense({ spentOn: d("2026-11-30"), amount: cents(500), paymentAccountId: cash.id }),
      makeExpense({ spentOn: d("2026-12-01"), amount: cents(600), paymentAccountId: cash.id }),
    ];
    expect(spendingByPaymentMethod(expenses, accounts, firstHalf).byAccount.get(cash.id)).toBe(500);
    expect(spendingByPaymentMethod(expenses, accounts, secondHalf).byAccount.get(cash.id)).toBe(
      900,
    );
  });

  it("groups by account and adds null or unknown methods to unspecified", () => {
    const expenses = [
      makeExpense({ spentOn: d("2026-11-02"), amount: cents(1_000), paymentAccountId: cash.id }),
      makeExpense({ spentOn: d("2026-11-03"), amount: cents(2_000), paymentAccountId: card.id }),
      makeExpense({ spentOn: d("2026-11-04"), amount: cents(500), paymentAccountId: card.id }),
      makeExpense({ spentOn: d("2026-11-05"), amount: cents(70), paymentAccountId: null }),
      makeExpense({ spentOn: d("2026-11-06"), amount: cents(30), paymentAccountId: "x" as Uuid }),
    ];
    const r = spendingByPaymentMethod(expenses, accounts, firstHalf);
    expect(r.byAccount.get(cash.id)).toBe(1_000);
    expect(r.byAccount.get(card.id)).toBe(2_500);
    expect(r.byAccount.has("x" as Uuid)).toBe(false);
    expect(r.unspecified).toBe(100);
    expect(r.total).toBe(3_600);
  });

  it("keeps archived accounts and counts recurring charges", () => {
    const old = makeCard({ name: "Old", archived: true });
    const expenses = [
      makeExpense({ spentOn: d("2026-11-02"), amount: cents(800), paymentAccountId: old.id }),
      makeExpense({
        spentOn: d("2026-11-01"),
        amount: cents(1_200),
        paymentAccountId: card.id,
        origin: "recurring",
      }),
    ];
    const r = spendingByPaymentMethod(expenses, [...accounts, old], firstHalf);
    expect(r.byAccount.get(old.id)).toBe(800);
    expect(r.byAccount.get(card.id)).toBe(1_200);
    expect(r.total).toBe(2_000);
  });

  it("is zero for a period without expenses", () => {
    const r = spendingByPaymentMethod([], accounts, firstHalf);
    expect(r.byAccount.size).toBe(0);
    expect(r.unspecified).toBe(0);
    expect(r.total).toBe(0);
  });
});
