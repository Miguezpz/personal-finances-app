"use client";

/**
 * Exchange rates for display (T108, FR-033…036). One request per app load (shared by every
 * consumer through TanStack Query), validated with isPlausibleRate; the last valid rate is kept on
 * the device. If no source answers — or the answer is implausible — the previous rate is used and
 * marked `stale`; with nothing saved, `fx` is null and the app simply stays in MXN. It never throws.
 *
 * Same behaviour in demo and live: the request carries no user data (Principle V).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/data/query-keys";
import { isPlausibleRate } from "@/domain/fx";
import type { FxSnapshot } from "@/domain/types";
import { fetchFxRates } from "./api";
import { loadStoredFx, saveStoredFx, withStale } from "./storage";

async function loadFx(): Promise<FxSnapshot | null> {
  const previous = loadStoredFx();
  try {
    const fresh = await fetchFxRates();
    if (!isPlausibleRate(fresh.rates, previous?.rates ?? null)) {
      return previous ? withStale(previous, true) : null;
    }
    saveStoredFx(fresh);
    return withStale(fresh, false);
  } catch {
    return previous ? withStale(previous, true) : null;
  }
}

export interface FxRatesState {
  /** null = no rate available at all (stay in MXN). */
  fx: FxSnapshot | null;
  isLoading: boolean;
  isFetching: boolean;
  /** Never true: failures resolve to a stale or null rate. Kept for callers' clarity. */
  isError: boolean;
  retry: () => Promise<unknown>;
}

export function useFxRates(): FxRatesState {
  const query = useQuery({
    queryKey: queryKeys.fx,
    queryFn: loadFx,
    // Daily rates: once per load is enough; the user can retry explicitly.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return {
    fx: query.data ?? null,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    retry: () => query.refetch(),
  };
}
