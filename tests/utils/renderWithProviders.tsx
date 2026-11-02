/**
 * Renders UI with the real providers (T055): a fresh QueryClient (no retries), the MockProvider
 * (or an injected one), next-intl with the requested locale, and hydrated preferences.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { DataProviderProvider } from "@/data/context";
import { createMockProvider } from "@/data/mock/provider";
import type { DataProvider } from "@/data/provider";
import { DEFAULT_TIMEZONE } from "@/domain/settings";
import type { FinanceSnapshot, Locale } from "@/domain/types";
import { MESSAGES } from "@/i18n/config";
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  type PersistedPreferences,
} from "@/store/preferences";

export interface ProvidersOptions {
  provider?: DataProvider;
  /** Snapshot for the default MockProvider. */
  snapshot?: FinanceSnapshot;
  locale?: Locale;
  preferences?: Partial<PersistedPreferences> & { hydrated?: boolean };
  queryClient?: QueryClient;
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
}

function setup(options: ProvidersOptions) {
  const locale = options.locale ?? options.preferences?.locale ?? "en";
  const provider =
    options.provider ?? createMockProvider(options.snapshot ? { snapshot: options.snapshot } : {});
  const queryClient = options.queryClient ?? createTestQueryClient();
  usePreferences.setState({
    ...DEFAULT_PREFERENCES,
    hydrated: true,
    ...options.preferences,
    locale,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        timeZone={DEFAULT_TIMEZONE}
      >
        <DataProviderProvider provider={provider}>{children}</DataProviderProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { provider, queryClient, wrapper };
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions & Omit<RenderOptions, "wrapper"> = {},
) {
  const { provider, queryClient, wrapper } = setup(options);
  return { ...render(ui, { wrapper }), provider, queryClient };
}

export function renderHookWithProviders<T>(hook: () => T, options: ProvidersOptions = {}) {
  const { provider, queryClient, wrapper } = setup(options);
  return { ...renderHook(hook, { wrapper }), provider, queryClient };
}
