import {
  BookText,
  CalendarClock,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Key in the `nav` namespace. */
  labelKey:
    | "dashboard"
    | "income"
    | "expenses"
    | "recurring"
    | "receivables"
    | "credit"
    | "goals"
    | "netWorth"
    | "ledger"
    | "settings";
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/income", labelKey: "income", icon: PiggyBank },
  { href: "/expenses", labelKey: "expenses", icon: Receipt },
  { href: "/recurring", labelKey: "recurring", icon: CalendarClock },
  { href: "/receivables", labelKey: "receivables", icon: HandCoins },
  { href: "/credit", labelKey: "credit", icon: CreditCard },
  { href: "/goals", labelKey: "goals", icon: Target },
  { href: "/net-worth", labelKey: "netWorth", icon: TrendingUp },
  { href: "/ledger", labelKey: "ledger", icon: BookText },
  { href: "/settings", labelKey: "settings", icon: Settings },
];
