"use client";

/**
 * The card payment dialog in its own chunk (spec 008, research.md R3): DialogHost mounts it for
 * every route, so its form stack stays out of First Load JS.
 */
import { lazy, Suspense, useEffect, type ComponentProps } from "react";

const load = () => import("./CardPaymentDialog");
const CardPaymentDialog = lazy(() => load().then((m) => ({ default: m.CardPaymentDialog })));

export function LazyCardPaymentDialog(props: ComponentProps<typeof CardPaymentDialog>) {
  return (
    <Suspense fallback={null}>
      <CardPaymentDialog {...props} />
    </Suspense>
  );
}

export function usePreloadCardPaymentDialog() {
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
