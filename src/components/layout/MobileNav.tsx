"use client";

/**
 * Mobile bottom navigation (spec 008, US1/US2, FR-003–FR-007): Home · Expenses · ＋ · Credit · More,
 * in the thumb zone above the safe area. The raised "＋" is the screen's only highlighted call to
 * action on mobile and toggles the create sheet; "More" opens the remaining destinations and is
 * marked as the current page whenever the route is one of them. Replaces spec 003's bar and its
 * floating "Add expense" button (FR-019/FR-020).
 */
import { Ellipsis, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { NavIndicator } from "./NavIndicator";
import { isActiveRoute, isSecondaryRoute, MOBILE_BAR_ITEMS, type NavItem } from "./nav-items";

const ITEM_CLASS = cn(
  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] leading-tight transition-colors duration-fast",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
);

function ItemBody({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <>
      <span
        data-nav-anchor
        className={cn(
          "relative z-10 flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-fast",
          active &&
            "bg-nav-active text-nav-active-foreground group-data-[indicator=ready]/nav:bg-transparent",
        )}
      >
        {icon}
      </span>
      <span className="relative z-10 max-w-full truncate">{label}</span>
    </>
  );
}

function BarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const t = useTranslations("nav");
  const active = isActiveRoute(pathname, item.href);
  const Icon = item.icon;
  return (
    <li className="min-w-0">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        data-testid={`mobile-nav-${item.href.slice(1)}`}
        className={cn(
          ITEM_CLASS,
          active
            ? "font-semibold text-foreground"
            : "font-medium text-muted-foreground hover:text-foreground",
        )}
      >
        <ItemBody
          active={active}
          icon={<Icon aria-hidden="true" className="size-5" />}
          label={t(item.labelKey)}
        />
      </Link>
    </li>
  );
}

export function MobileNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const createOpen = useUi((s) => s.createSheetOpen);
  const setCreateOpen = useUi((s) => s.setCreateSheetOpen);
  const listRef = useRef<HTMLDivElement>(null);
  const [home, expenses, credit] = MOBILE_BAR_ITEMS as [NavItem, NavItem, NavItem];
  const moreActive = isSecondaryRoute(pathname);

  return (
    <nav
      aria-label={t("mobileLabel")}
      data-testid="mobile-nav"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div ref={listRef} className="group/nav relative">
        <NavIndicator listRef={listRef} className="rounded-full" />
        <ul className="grid grid-cols-5">
          <BarLink item={home} pathname={pathname} />
          <BarLink item={expenses} pathname={pathname} />
          <li className="flex min-w-0 items-center justify-center">
            <button
              type="button"
              data-testid="mobile-nav-create"
              aria-label={t("create")}
              aria-haspopup="dialog"
              aria-expanded={createOpen}
              data-state={createOpen ? "open" : "closed"}
              onClick={() => setCreateOpen(!createOpen)}
              className={cn(
                // relative z-10: above the sliding indicator, which crosses it between Expenses and Credit.
                "group/create relative z-10 -mt-5 flex size-14 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-[0_6px_18px_-4px] ring-4 shadow-cta/60 ring-background transition-[box-shadow,background-color] duration-fast",
                "focus-visible:ring-ring focus-visible:outline-none active:shadow-[0_2px_8px_-2px]",
              )}
            >
              <Plus
                aria-hidden="true"
                className="size-6 transition-transform duration-base ease-out-quint group-data-[state=open]/create:rotate-45"
              />
            </button>
          </li>
          <BarLink item={credit} pathname={pathname} />
          <li className="min-w-0">
            <button
              type="button"
              data-testid="mobile-nav-more"
              aria-haspopup="dialog"
              aria-expanded={sidebarOpen}
              aria-current={moreActive ? "page" : undefined}
              onClick={() => setSidebarOpen(true)}
              className={cn(
                ITEM_CLASS,
                moreActive
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              <ItemBody
                active={moreActive}
                icon={<Ellipsis aria-hidden="true" className="size-5" />}
                label={t("more")}
              />
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
