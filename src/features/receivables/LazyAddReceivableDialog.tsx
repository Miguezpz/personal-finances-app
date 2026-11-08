"use client";

/** The new-receivable dialog in its own chunk (spec 009): DialogHost mounts it for every route so
 * "Retry" can reopen it from anywhere, without adding its form to First Load JS. */
import { lazy, Suspense, type ComponentProps } from "react";

const AddReceivableDialog = lazy(() =>
  import("./AddReceivableDialog").then((m) => ({ default: m.AddReceivableDialog })),
);

export function LazyAddReceivableDialog(props: ComponentProps<typeof AddReceivableDialog>) {
  return (
    <Suspense fallback={null}>
      <AddReceivableDialog {...props} />
    </Suspense>
  );
}
