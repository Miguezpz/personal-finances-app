"use client";

/** The three app-wide create actions (spec 008, FR-007/FR-010/FR-011): one source for the "＋"
 * sheet, the desktop "＋ New" menu and the N/I/P shortcuts. */
import { CreditCard, PiggyBank, Receipt, type LucideIcon } from "lucide-react";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot } from "@/domain/types";
import type { CreateDialogKind } from "@/store/ui";

export interface CreateAction {
  kind: CreateDialogKind;
  /** Key in the `create` namespace. */
  labelKey: "expense" | "income" | "cardPayment";
  icon: LucideIcon;
  /** Desktop keyboard shortcut (lower case). */
  shortcut: "n" | "i" | "p";
  testId: "expense" | "income" | "card-payment";
}

export const CREATE_ACTIONS: readonly CreateAction[] = [
  { kind: "expense", labelKey: "expense", icon: Receipt, shortcut: "n", testId: "expense" },
  { kind: "income", labelKey: "income", icon: PiggyBank, shortcut: "i", testId: "income" },
  {
    kind: "card-payment",
    labelKey: "cardPayment",
    icon: CreditCard,
    shortcut: "p",
    testId: "card-payment",
  },
];

const selectHasCards = (s: FinanceSnapshot) =>
  s.accounts.some((a) => a.kind === "credit_card" && !a.archived);

/** "Pay card" needs at least one active credit card (FR-013). Unknown while loading → false. */
export function useHasActiveCards(): boolean {
  return useFinanceSnapshot(selectHasCards).data ?? false;
}
