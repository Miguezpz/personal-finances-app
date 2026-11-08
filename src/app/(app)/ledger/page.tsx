import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerPage } from "@/features/ledger/LedgerPage";

/**
 * Ledger: every movement, filterable and exportable (T125, US8). Its filters live in the URL
 * (spec 009), so the page renders inside a Suspense boundary.
 */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <LedgerPage />
    </Suspense>
  );
}
