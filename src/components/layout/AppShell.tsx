"use client";

/**
 * App shell (T053): navigation to every section, the header toolbar that hosts the language,
 * currency and privacy toggles (LanguageToggle T116, CurrencyToggle T109, PrivacyToggle T132),
 * cold-start / offline status, and the background processes of the authenticated area.
 */
import { CloudOff, LogOut, Menu, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDataProvider } from "@/data/context";
import { useAuthSync, useSession } from "@/features/auth/useSession";
import { useOnboarding } from "@/features/settings/onboarding";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { NAV_ITEMS } from "./nav-items";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <li key={href}>
            <Link
              href={href}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "bg-muted text-foreground" : "text-muted-foreground",
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
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")}>
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-4">
            <SheetHeader className="p-0 pb-4">
              <SheetTitle>{tc("appName")}</SheetTitle>
            </SheetHeader>
            <nav aria-label={t("label")}>
              <NavLinks onNavigate={() => setSidebarOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Wallet aria-hidden="true" className="size-5" />
          <span className="truncate">{tc("appName")}</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          {toolbar}
          {canSignOut && (
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{t("signOut")}</span>
            </Button>
          )}
        </div>
      </header>

      <StatusBanners />
      <BackgroundProcesses />

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <aside className="hidden w-56 shrink-0 border-r p-4 md:block">
          <nav aria-label={t("label")} className="sticky top-18">
            <NavLinks />
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
