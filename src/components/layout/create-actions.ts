"use client";

/** The app-wide create actions (spec 008, FR-007/FR-010/FR-011): one source for the "＋" sheet, the
 * desktop "＋ New" menu and the N/I shortcuts. Spec 011 removed "Pay card": a card is marked as
 * paid from the card itself ("Ya la pagué"). */
import { PiggyBank, Receipt, type LucideIcon } from "lucide-react";
import type { CreateDialogKind } from "@/store/ui";

export interface CreateAction {
  kind: CreateDialogKind;
  /** Key in the `create` namespace. */
  labelKey: "expense" | "income";
  icon: LucideIcon;
  /** Desktop keyboard shortcut (lower case). */
  shortcut: "n" | "i";
  testId: "expense" | "income";
}

export const CREATE_ACTIONS: readonly CreateAction[] = [
  { kind: "expense", labelKey: "expense", icon: Receipt, shortcut: "n", testId: "expense" },
  { kind: "income", labelKey: "income", icon: PiggyBank, shortcut: "i", testId: "income" },
];
