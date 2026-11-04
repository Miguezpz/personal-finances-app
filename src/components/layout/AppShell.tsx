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
import { useEffect, type ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDataProvider } from "@/data/context";
import { useAuthSync, useSession } from "@/features/auth/useSession";
import { FxStatus } from "@/features/fx/FxStatus";
import { useMaterializeContributions } from "@/features/goals/useMaterializeContributions";
import { useNetWorthSnapshot } from "@/features/net-worth/useNetWorthSnapshot";
import { useMaterializeRecurring } from "@/features/recurring/useMaterializeRecurring";
import { useOnboarding } from "@/features/settings/onboarding";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { CurrencyToggle } from "./CurrencyToggle";
import { DemoBanner } from "./DemoBanner";
import { LanguageToggle } from "./LanguageToggle";
import { MobileNav } from "./MobileNav";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavItem } from "./nav-items";
import { PreferencesSheet } from "./PreferencesSheet";
import { PrivacyToggle } from "./PrivacyToggle";
import { ThemeToggle } from "./ThemeToggle";

function NavLinks({
  items = NAV_ITEMS,
  onNavigate,
}: {
  items?: readonly NavItem[];
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-fast pointer-coarse:min-h-11",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "bg-nav-active font-semibold text-nav-active-foreground"
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
    await provider.auth.signOut();
    router.replace("/");
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
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
        {/* Mobile "More" sheet (opened from the bottom bar): the sections the bar doesn't show. */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-4">
            <SheetHeader className="p-0 pb-4">
              <SheetTitle>{tc("appName")}</SheetTitle>
            </SheetHeader>
            <nav aria-label={t("label")}>
              <NavLinks items={SECONDARY_NAV_ITEMS} onNavigate={() => setSidebarOpen(false)} />
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
        <aside className="hidden w-60 shrink-0 border-r bg-sidebar p-4 md:block">
          <nav aria-label={t("label")} className="sticky top-18">
            <NavLinks />
          </nav>
        </aside>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none md:p-6"
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
