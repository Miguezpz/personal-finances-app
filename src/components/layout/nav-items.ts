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

/** Navigation groups (spec 008, FR-001), in display order. */
export type NavGroupId = "main" | "plan" | "debts" | "insights" | "footer";

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
  group: NavGroupId;
}

/** Every destination, already in display order (groups first, then order inside the group). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, group: "main" },
  { href: "/expenses", labelKey: "expenses", icon: Receipt, group: "main" },
  { href: "/income", labelKey: "income", icon: PiggyBank, group: "main" },
  { href: "/credit", labelKey: "credit", icon: CreditCard, group: "main" },
  { href: "/recurring", labelKey: "recurring", icon: CalendarClock, group: "plan" },
  { href: "/goals", labelKey: "goals", icon: Target, group: "plan" },
  { href: "/receivables", labelKey: "receivables", icon: HandCoins, group: "debts" },
  { href: "/ledger", labelKey: "ledger", icon: BookText, group: "insights" },
  { href: "/net-worth", labelKey: "netWorth", icon: TrendingUp, group: "insights" },
  { href: "/settings", labelKey: "settings", icon: Settings, group: "footer" },
];

export interface NavGroup {
  id: NavGroupId;
  items: readonly NavItem[];
}

const GROUP_ORDER: readonly NavGroupId[] = ["main", "plan", "debts", "insights", "footer"];

function groupsOf(items: readonly NavItem[]): NavGroup[] {
  return GROUP_ORDER.map((id) => ({ id, items: items.filter((i) => i.group === id) })).filter(
    (g) => g.items.length > 0,
  );
}

export const NAV_GROUPS: readonly NavGroup[] = groupsOf(NAV_ITEMS);

/** Destinations of the mobile bottom bar (spec 008, FR-003); "＋" and "More" sit between/after. */
const MOBILE_BAR_ORDER = ["/dashboard", "/expenses", "/credit"];
export const MOBILE_BAR_ITEMS: readonly NavItem[] = MOBILE_BAR_ORDER.map(
  (href) => NAV_ITEMS.find((item) => item.href === href) as NavItem,
);

/** What the "More" panel lists: every destination the bottom bar doesn't show, grouped. */
export const SECONDARY_NAV_GROUPS: readonly NavGroup[] = groupsOf(
  NAV_ITEMS.filter((item) => !MOBILE_BAR_ORDER.includes(item.href)),
);

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** true when the route belongs to a destination that only the "More" panel lists (FR-005). */
export function isSecondaryRoute(pathname: string): boolean {
  return !MOBILE_BAR_ORDER.some((href) => isActiveRoute(pathname, href));
}

/** Icon of a page, for its title and empty state (spec 004): one source shared with the nav. */
export function navIcon(href: NavItem["href"]): LucideIcon {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item.icon;
}

/** Square tile shared by the "＋" sheet and the "More" grid (spec 012). */
export const TILE_CLASS =
  "flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
