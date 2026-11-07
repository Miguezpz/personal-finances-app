/**
 * Spending by payment method for one period (Expenses page): how much went out in cash, on each
 * card, by debit… Only expenses count — card payments settle debt and third-party MSI aren't
 * personal expenses. An expense without a payment method, or whose account is unknown, adds to
 * `unspecified`. Archived accounts keep their spending. Pure; the range comes from the period.
 */
import { addCents, ZERO_CENTS } from "./money";
import type { Account, Cents, Expense, Period, Uuid } from "./types";

export interface SpendingByMethod {
  byAccount: Map<Uuid, Cents>;
  unspecified: Cents;
  total: Cents;
}

export function spendingByPaymentMethod(
  expenses: readonly Expense[],
  accounts: readonly Pick<Account, "id">[],
  period: Pick<Period, "start" | "end">,
): SpendingByMethod {
  const known = new Set(accounts.map((a) => a.id));
  const byAccount = new Map<Uuid, Cents>();
  let unspecified = ZERO_CENTS;
  let total = ZERO_CENTS;
  for (const e of expenses) {
    if (e.spentOn < period.start || e.spentOn > period.end) continue;
    total = addCents(total, e.amount);
    const id = e.paymentAccountId;
    if (id && known.has(id)) byAccount.set(id, addCents(byAccount.get(id) ?? ZERO_CENTS, e.amount));
    else unspecified = addCents(unspecified, e.amount);
  }
  return { byAccount, unspecified, total };
}
