/**
 * When an account's kind can change. The kind is free to change while nothing recorded depends on
 * it; a reference that only makes sense for the current kind (or that the new kind can't hold)
 * blocks the change, so the history never ends up inconsistent:
 *  - a credit card with card payments or MSI purchases can't stop being a card;
 *  - an account that received income or paid a card can't become a card (cards hold debt, not
 *    money);
 *  - an investment account used by a distribution rule can't stop being an investment.
 * Expenses paid with the account don't block it: switching a card to debit is exactly how a
 * mis-typed account gets fixed. Pure.
 */
import type { Account, AccountKind, FinanceSnapshot } from "./types";

export type KindChangeBlocker = "cardHistory" | "moneyHistory" | "investmentRules";

export function kindChangeBlocker(
  account: Pick<Account, "id" | "kind">,
  next: AccountKind,
  s: Pick<FinanceSnapshot, "cardPayments" | "receivables" | "incomes" | "allocations" | "rules">,
): KindChangeBlocker | null {
  if (next === account.kind) return null;
  const id = account.id;
  if (
    account.kind === "credit_card" &&
    (s.cardPayments.some((p) => p.cardAccountId === id) ||
      s.receivables.some((r) => r.cardAccountId === id))
  ) {
    return "cardHistory";
  }
  if (
    next === "credit_card" &&
    (s.cardPayments.some((p) => p.fromAccountId === id) ||
      s.incomes.some((i) => i.depositAccountId === id) ||
      s.allocations.some((a) => a.accountId === id))
  ) {
    return "moneyHistory";
  }
  if (
    account.kind === "investment" &&
    s.rules.some((r) => r.investmentSubrules.some((x) => x.accountId === id))
  ) {
    return "investmentRules";
  }
  return null;
}
