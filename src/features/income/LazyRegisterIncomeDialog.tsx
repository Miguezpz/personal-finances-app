"use client";

/**
 * The income dialog in its own chunk (spec 008, research.md R3): DialogHost mounts it for every
 * route, so its form stack stays out of First Load JS — same approach as LazyAddExpenseDialog.
 */
import { lazy, Suspense, useEffect, type ComponentProps } from "react";

const load = () => import("./RegisterIncomeDialog");
const RegisterIncomeDialog = lazy(() => load().then((m) => ({ default: m.RegisterIncomeDialog })));

export function LazyRegisterIncomeDialog(props: ComponentProps<typeof RegisterIncomeDialog>) {
  return (
    <Suspense fallback={null}>
      <RegisterIncomeDialog {...props} />
    </Suspense>
  );
}

export function usePreloadRegisterIncomeDialog() {
  useEffect(() => {
    const preload = () => void load();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 400);
    return () => clearTimeout(id);
  }, []);
}
