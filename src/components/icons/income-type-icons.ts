/**
 * Income type → icon (spec 004, research R7). Named imports only, so the bundle carries exactly
 * these icons; `satisfies` makes a missing type a compile error.
 */
import {
  BadgePercent,
  Briefcase,
  CirclePlus,
  Ellipsis,
  Gift,
  HandCoins,
  type LucideIcon,
  PiggyBank,
  Store,
  TrendingUp,
} from "lucide-react";
import type { IncomeType } from "@/domain/income-types";

export const INCOME_TYPE_ICONS = {
  salary: Briefcase,
  gift: Gift,
  debt_repayment: HandCoins,
  cashback: BadgePercent,
  extra: CirclePlus,
  sales: Store,
  savings: PiggyBank,
  investment_returns: TrendingUp,
  other: Ellipsis,
} as const satisfies Record<IncomeType, LucideIcon>;
