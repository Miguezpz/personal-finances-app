"use client";

/**
 * <DataProviderProvider> + useDataProvider() (T042). Components only ever see the DataProvider
 * interface and its capabilities, never which implementation is active.
 */
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { createDataProvider } from "./index";
import type { DataProvider } from "./provider";

const DataProviderContext = createContext<DataProvider | null>(null);

interface Props {
  children: ReactNode;
  /** Rendered while the provider module loads (one dynamic import). */
  fallback?: ReactNode;
  /** Inject a provider directly (tests, Storybook-like harnesses). */
  provider?: DataProvider;
}

export function DataProviderProvider({ children, fallback = null, provider: injected }: Props) {
  const [provider, setProvider] = useState<DataProvider | null>(injected ?? null);

  useEffect(() => {
    if (injected) return;
    let cancelled = false;
    void createDataProvider().then((p) => {
      if (!cancelled) setProvider(p);
    });
    return () => {
      cancelled = true;
    };
  }, [injected]);

  if (!provider) return fallback;
  return <DataProviderContext value={provider}>{children}</DataProviderContext>;
}

export function useDataProvider(): DataProvider {
  const provider = use(DataProviderContext);
  if (!provider) throw new Error("useDataProvider must be used inside <DataProviderProvider>");
  return provider;
}

/** Capability shortcut for UI and hooks (never ask for the provider type). */
export function useCanWrite(): boolean {
  return useDataProvider().capabilities.canWrite;
}
