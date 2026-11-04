"use client";

/**
 * Client providers (T050): TanStack Query, preferences (+ effects), next-intl with BOTH
 * dictionaries, the DataProvider and the toaster.
 *
 * Rendering is gated on hydrated preferences: the server and the first client render show a
 * text-free skeleton, then the app renders directly in the stored locale. Together with the
 * inline <head> script this avoids both a hydration mismatch and a flash of the wrong
 * language or of amounts (instead of reading the NEXT_LOCALE cookie in the root layout, which
 * under Cache Components would make every route request-bound).
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BootSkeleton } from "@/components/layout/BootSkeleton";
import { Toaster } from "@/components/ui/sonner";
import { DataProviderProvider } from "@/data/context";
import { DEFAULT_TIMEZONE } from "@/domain/settings";
import { MESSAGES } from "@/i18n/config";
import {
  notifyDemoReadOnly,
  notifyOffline,
  setDemoReadOnlyNotifier,
  setOfflineNotifier,
} from "@/lib/demo-notice";
import { createQueryClient } from "@/lib/query-client";
import { PreferencesEffects } from "@/store/effects";
import { selectHydrated, selectLocale, usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";

const DEMO_TOAST_ID = "demo-read-only";
const OFFLINE_TOAST_ID = "offline";

/**
 * Browser tab title in the active language. Rendered as a React 19 <title> (hoisted to <head>);
 * the root layout has no static title because Next streams metadata and would overwrite it.
 */
function DocumentTitle() {
  return <title>{useTranslations("common")("appName")}</title>;
}

function PreferencesGate({ children }: { children: ReactNode }) {
  const hydrated = usePreferences(selectHydrated);
  return hydrated ? children : <BootSkeleton />;
}

function IntlProvider({ children }: { children: ReactNode }) {
  const locale = usePreferences(selectLocale);
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone={DEFAULT_TIMEZONE}>
      {children}
    </NextIntlClientProvider>
  );
}

/** Lets the QueryClient (created outside React) show translated, de-duplicated toasts. */
function DemoToastBridge() {
  const t = useTranslations("common");
  useEffect(() => {
    setDemoReadOnlyNotifier(() => toast.info(t("demoReadOnly"), { id: DEMO_TOAST_ID }));
    setOfflineNotifier(() => toast.warning(t("offline"), { id: OFFLINE_TOAST_ID }));
    return () => {
      setDemoReadOnlyNotifier(null);
      setOfflineNotifier(null);
    };
  }, [t]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() =>
    createQueryClient({
      onDemoReadOnly: notifyDemoReadOnly,
      onOffline: notifyOffline,
      onWakingChange: (waking) => useUi.getState().setWaking(waking),
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesEffects />
      <PreferencesGate>
        <IntlProvider>
          <DemoToastBridge />
          <DocumentTitle />
          <DataProviderProvider fallback={<BootSkeleton />}>{children}</DataProviderProvider>
          <Toaster position="top-center" />
        </IntlProvider>
      </PreferencesGate>
    </QueryClientProvider>
  );
}
