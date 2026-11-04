"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Live `matchMedia` result. `serverValue` is used during SSR/hydration and when matchMedia is unavailable.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia(query).matches
        : serverValue,
    () => serverValue,
  );
}

/** Tailwind's `md` breakpoint (48rem = 768 px). */
export const MD_QUERY = "(min-width: 48rem)";
