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
  /** One of the four destinations of the mobile bottom bar (spec 003, FR-019). */
  primary?: true;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, primary: true },
  { href: "/income", labelKey: "income", icon: PiggyBank, primary: true },
  { href: "/expenses", labelKey: "expenses", icon: Receipt, primary: true },
  { href: "/recurring", labelKey: "recurring", icon: CalendarClock },
  { href: "/receivables", labelKey: "receivables", icon: HandCoins },
  { href: "/credit", labelKey: "credit", icon: CreditCard },
  { href: "/goals", labelKey: "goals", icon: Target, primary: true },
  { href: "/net-worth", labelKey: "netWorth", icon: TrendingUp },
  { href: "/ledger", labelKey: "ledger", icon: BookText },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

/** Bottom bar order (FR-019): Dashboard, Expenses, Income, Goals — then "More". */
const PRIMARY_ORDER = ["/dashboard", "/expenses", "/income", "/goals"];
export const PRIMARY_NAV_ITEMS: readonly NavItem[] = PRIMARY_ORDER.map(
  (href) => NAV_ITEMS.find((item) => item.href === href) as NavItem,
);
/** Everything the bottom bar doesn't show: listed by the "More" sheet. */
export const SECONDARY_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => !item.primary);

/** Icon of a page, for its title and empty state (spec 004): one source shared with the nav. */
export function navIcon(href: NavItem["href"]): LucideIcon {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item.icon;
}
