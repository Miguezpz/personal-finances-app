/**
 * Decorative icons for domain values (spec 004, FR-014). Same pattern as category-icons.ts:
 * named imports and `satisfies` over the domain union, so a new enum value without an icon fails
 * to compile. They always sit next to their text (aria-hidden), never replace it (FR-016).
 */
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleCheck,
  CircleDashed,
  Clock,
  CreditCard,
  HandCoins,
  Landmark,
  LifeBuoy,
  type LucideIcon,
  PiggyBank,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sprout,
  TrendingUp,
} from "lucide-react";
import type {
  AccountKind,
  Bucket,
  GoalKind,
  InstallmentStatus,
  LedgerEntryType,
} from "@/domain/types";

export const ACCOUNT_KIND_ICONS = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  investment: TrendingUp,
  cash: Banknote,
} as const satisfies Record<AccountKind, LucideIcon>;

export const BUCKET_ICONS = {
  needs: ShieldCheck,
  wants: Sparkles,
  investment: Sprout,
} as const satisfies Record<Bucket, LucideIcon>;

export const LEDGER_TYPE_ICONS = {
  expense: ArrowUpRight,
  recurring_expense: ArrowUpRight,
  income: ArrowDownLeft,
  installment_collection: HandCoins,
} as const satisfies Record<LedgerEntryType, LucideIcon>;

export const RECEIVABLE_STATUS_ICONS = {
  pending: Clock,
  partial: CircleDashed,
  collected: CircleCheck,
} as const satisfies Record<InstallmentStatus, LucideIcon>;

export const GOAL_KIND_ICONS = {
  emergency_fund: LifeBuoy,
  sinking_fund: PiggyBank,
  purchase: ShoppingBag,
} as const satisfies Record<GoalKind, LucideIcon>;
