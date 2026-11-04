"use client";

/**
 * Mobile bottom navigation (spec 003, US2, FR-019/FR-020): the four main destinations + "More" (opens the side sheet
 * with the remaining sections) in the thumb zone, above the safe area, and the floating "Add expense" CTA — the only
 * highlighted call to action on mobile (FR-006). The CTA hides while scrolling down and while a field has focus, so
 * it never covers what's being edited.
 */
import { Ellipsis, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AddExpenseDialog } from "@/features/expenses/AddExpenseDialog";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { NavIndicator } from "./NavIndicator";
import { PRIMARY_NAV_ITEMS } from "./nav-items";

/** Hide after a deliberate scroll down, show again after a short scroll up; always visible near the top. */
const HIDE_AFTER_PX = 64;
const SHOW_AFTER_PX = 24;
const ALWAYS_VISIBLE_TOP_PX = 120;
const FIELD_SELECTOR = "input, select, textarea, [contenteditable='true']";

/**
 * Hidden while scrolling down (once the scroll in that direction exceeds HIDE_AFTER_PX) or while a form field has
 * focus. Distances accumulate per direction, so small jitters (or iOS bounce) don't make it flicker.
 */
function useFabHidden(): boolean {
  const [scrolledDown, setScrolledDown] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let travelled = 0; // > 0: down, < 0: up, since the last change of direction
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      if (y <= ALWAYS_VISIBLE_TOP_PX) {
        travelled = 0;
        setScrolledDown(false);
        return;
      }
      if (delta === 0) return;
      if (Math.sign(delta) !== Math.sign(travelled)) travelled = 0;
      travelled += delta;
      if (travelled > HIDE_AFTER_PX) setScrolledDown(true);
      else if (travelled < -SHOW_AFTER_PX) setScrolledDown(false);
    };
    const onFocusIn = (e: FocusEvent) =>
      setEditing(e.target instanceof Element && e.target.matches(FIELD_SELECTOR));
    const onFocusOut = () => setEditing(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return scrolledDown || editing;
}

export function MobileNav() {
  const t = useTranslations("nav");
  const tExpenses = useTranslations("expenses");
  const pathname = usePathname();
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const [adding, setAdding] = useState(false);
  const fabHidden = useFabHidden();
  const listRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Button
        variant="cta"
        size="fab"
        aria-label={tExpenses("addTitle")}
        data-testid="fab-add-expense"
        onClick={() => setAdding(true)}
        tabIndex={fabHidden ? -1 : 0}
        aria-hidden={fabHidden || undefined}
        className={cn(
          "fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 transition-[transform,box-shadow,background-color] duration-base ease-out-quint md:hidden",
          fabHidden && "translate-y-[200%]",
        )}
      >
        <Plus aria-hidden="true" />
      </Button>

      <nav
        aria-label={t("mobileLabel")}
        data-testid="mobile-nav"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div ref={listRef} className="group/nav relative">
          <NavIndicator listRef={listRef} className="rounded-full" />
          <ul className="grid grid-cols-5">
            {PRIMARY_NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href} className="min-w-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    data-testid={`mobile-nav-${href.slice(1)}`}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] leading-tight transition-colors duration-fast",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                      active
                        ? "font-semibold text-foreground"
                        : "font-medium text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      data-nav-anchor
                      className={cn(
                        "relative z-10 flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-fast",
                        active &&
                          "bg-nav-active text-nav-active-foreground group-data-[indicator=ready]/nav:bg-transparent",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="relative z-10 max-w-full truncate">{t(labelKey)}</span>
                  </Link>
                </li>
              );
            })}
            <li className="min-w-0">
              <button
                type="button"
                data-testid="mobile-nav-more"
                aria-haspopup="dialog"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] leading-tight font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                )}
              >
                <span className="flex h-7 w-12 items-center justify-center">
                  <Ellipsis aria-hidden="true" className="size-5" />
                </span>
                <span className="max-w-full truncate">{t("more")}</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {adding && <AddExpenseDialog open={adding} onOpenChange={setAdding} />}
    </>
  );
}
