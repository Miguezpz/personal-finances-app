import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";

/**
 * Expenses, card payments and card debt (T092, T164, US4). The page reads its quincena and
 * filters from the URL (spec 009), so it renders inside a Suspense boundary: the skeleton is the
 * prerendered HTML and the page takes over on the client.
 */
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <ExpensesPage />
    </Suspense>
  );
}
