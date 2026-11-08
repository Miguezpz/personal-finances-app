"use client";

/**
 * App shell (T053): navigation to every section, the header toolbar that hosts the language,
 * currency and privacy toggles (LanguageToggle T116, CurrencyToggle T109, PrivacyToggle T132),
 * cold-start / offline status, and the background processes of the authenticated area.
 */
import { CloudOff, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDataProvider } from "@/data/context";
import { useAuthSync, useSession } from "@/features/auth/useSession";
import { FxStatus } from "@/features/fx/FxStatus";
import { useMaterializeContributions } from "@/features/goals/useMaterializeContributions";
import { useNetWorthSnapshot } from "@/features/net-worth/useNetWorthSnapshot";
import { useRescheduleInstallments } from "@/features/receivables/useRescheduleInstallments";
import { useMaterializeRecurring } from "@/features/recurring/useMaterializeRecurring";
import { useOnboarding } from "@/features/settings/onboarding";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { CurrencyToggle } from "./CurrencyToggle";
import { DemoBanner } from "./DemoBanner";
import { LanguageToggle } from "./LanguageToggle";
import { MobileNav } from "./MobileNav";
import { CreateSheet } from "./CreateSheet";
import { DialogHost } from "./DialogHost";
import {
  isActiveRoute,
  NAV_GROUPS,
  SECONDARY_NAV_GROUPS,
  type NavGroup,
  type NavItem,
} from "./nav-items";
import { NewMenu } from "./NewMenu";
import { NavIndicator } from "./NavIndicator";
import { PreferencesSheet } from "./PreferencesSheet";
import { PrivacyToggle } from "./PrivacyToggle";
import { ThemeToggle } from "./ThemeToggle";

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: readonly NavItem[];
  pathname: string;
  onNavigate?: (() => void) | undefined;
}) {
  const t = useTranslations("nav");
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = isActiveRoute(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative z-10 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast pointer-coarse:min-h-11",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? // The sliding indicator paints the background once measured (NavIndicator).
                    "bg-nav-active font-semibold text-nav-active-foreground group-data-[indicator=ready]/nav:bg-transparent"
                  : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {t(labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Grouped destinations (spec 008, FR-001/FR-002/FR-006): a discreet heading per group; the footer
 * group (Settings) has no heading and is pushed to the bottom by the sidebar's flex column.
 */
function NavGroups({
  groups,
  onNavigate,
  pinFooter = false,
}: {
  groups: readonly NavGroup[];
  onNavigate?: () => void;
  pinFooter?: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={listRef} className="group/nav relative flex min-h-full flex-col gap-4">
      <NavIndicator listRef={listRef} className="rounded-md" />
      {groups.map(({ id, items }) =>
        id === "footer" ? (
          <div key={id} className={cn("border-t pt-3", pinFooter && "mt-auto")}>
            <NavList items={items} pathname={pathname} onNavigate={onNavigate} />
          </div>
        ) : (
          <section key={id} aria-labelledby={`nav-group-${id}${onNavigate ? "-more" : ""}`}>
            <h2
              id={`nav-group-${id}${onNavigate ? "-more" : ""}`}
              className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {t(`groups.${id}`)}
            </h2>
            <NavList items={items} pathname={pathname} onNavigate={onNavigate} />
          </section>
        ),
      )}
    </div>
  );
}

function StatusBanners() {
  const t = useTranslations("common");
  const waking = useUi((s) => s.waking);
  const offline = useUi((s) => s.offline);
  if (!waking && !offline) return null;
  return (
    <div role="status" aria-live="polite" className="border-b bg-muted px-4 py-2 text-sm">
      {offline ? (
        <span className="flex items-center gap-2">
          <CloudOff aria-hidden="true" className="size-4" />
          {t("offline")}
        </span>
      ) : (
        t("wakingDatabase")
      )}
    </div>
  );
}

/** Background processes of the authenticated area (each checks capabilities.canWrite). */
function BackgroundProcesses() {
  useAuthSync();
  useOnboarding();
  useMaterializeRecurring();
  useRescheduleInstallments();
  useMaterializeContributions();
  useNetWorthSnapshot();
  return null;
}

/** Client-side guard: an expired session goes back to the landing page. */
function useRequireSession() {
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    if (session.isSuccess && session.data === null) router.replace("/");
  }, [router, session.isSuccess, session.data]);
  return session;
}

export function AppShell({ children, toolbar }: { children: ReactNode; toolbar?: ReactNode }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const provider = useDataProvider();
  const router = useRouter();
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);
  const session = useRequireSession();
  // The demo's synthetic session has no email: there's nothing to sign out of.
  const canSignOut = Boolean(session.data?.email);

  async function signOut() {
    try {
      await provider.auth.signOut();
    } catch {
      // The local session is already gone (the adapter falls back to a local sign-out), so
      // leaving the app is still correct; only the other devices' sessions may remain.
    } finally {
      router.replace("/");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* First stop for keyboard users: jump over the header and navigation (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-2 focus:ring-ring"
        data-testid="skip-link"
      >
        {tc("skipToContent")}
      </a>
      <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b bg-background/95 pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] backdrop-blur">
        {/* Mobile "More" panel (opened from the bottom bar): the destinations the bar doesn't show. */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            data-testid="more-sheet"
          >
            <SheetHeader className="p-0">
              <SheetTitle>{t("moreTitle")}</SheetTitle>
            </SheetHeader>
            <nav aria-label={t("label")}>
              <NavGroups groups={SECONDARY_NAV_GROUPS} onNavigate={() => setSidebarOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        >
          <BrandMark className="size-7" />
          <span className="sr-only truncate sm:not-sr-only">{tc("appName")}</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop: inline toggles. Mobile: logo, privacy and the preferences panel only (FR-021). */}
          <div className="hidden items-center gap-2 md:flex">
            <LanguageToggle />
            <CurrencyToggle />
            <ThemeToggle />
          </div>
          <PrivacyToggle />
          {toolbar}
          <NewMenu />
          {canSignOut && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => void signOut()}
            >
              <LogOut aria-hidden="true" />
              {t("signOut")}
            </Button>
          )}
          <PreferencesSheet {...(canSignOut ? { onSignOut: () => void signOut() } : {})} />
        </div>
      </header>

      <DemoBanner />
      <StatusBanners />
      <FxStatus />
      <BackgroundProcesses />

      <div className="flex w-full flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:block">
          {/* Scrolls on its own when the window is short (FR-002); Settings stays at the bottom. */}
          <nav
            aria-label={t("label")}
            className="sticky top-14 flex max-h-[calc(100dvh-3.5rem)] flex-col overflow-y-auto p-4"
          >
            <NavGroups groups={NAV_GROUPS} pinFooter />
          </nav>
        </aside>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none md:p-6 md:pb-6"
        >
          {children}
        </main>
      </div>
      <MobileNav />
      <CreateSheet />
      <DialogHost />
    </div>
  );
}
