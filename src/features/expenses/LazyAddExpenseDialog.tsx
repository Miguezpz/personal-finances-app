"use client";

/**
 * The new-expense dialog in its own chunk (spec 005, plan: Dashboard First Load JS < +5 KB gzip).
 * The Dashboard and the mobile floating button only need it once it's opened, so its form stack
 * (react-hook-form, zod, quick expense row) stays out of First Load JS — the same approach as the
 * theme menu (spec 003). `usePreloadAddExpenseDialog` fetches it right after hydration, so the
 * first open doesn't wait for the network.
 */
import { lazy, Suspense, useEffect, type ComponentProps } from "react";

const load = () => import("./AddExpenseDialog");
const AddExpenseDialog = lazy(() => load().then((m) => ({ default: m.AddExpenseDialog })));

export function LazyAddExpenseDialog(props: ComponentProps<typeof AddExpenseDialog>) {
  return (
    <Suspense fallback={null}>
      <AddExpenseDialog {...props} />
    </Suspense>
  );
}

export function usePreloadAddExpenseDialog() {
  useEffect(() => {
    const preload = () => void load();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 200);
    return () => clearTimeout(id);
  }, []);
}
