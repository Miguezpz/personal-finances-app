"use client";

/**
 * Background materialization of recurring charges (T082, FR-010, research.md R5): due
 * occurrences become `expenses` (origin 'recurring') when the app opens. Idempotent (the domain
 * only proposes missing months; the DB's unique key absorbs concurrent tabs). Scheduling, waiting
 * for in-flight writes and the demo rule live in `useBackgroundSync`.
 */
import { appendNew, type BackgroundSync, useBackgroundSync } from "@/data/background-sync";
import type { NewEntity } from "@/data/provider";
import { dueOccurrences } from "@/domain/recurring";
import type { Expense, FinanceSnapshot, IsoDate } from "@/domain/types";

/** The expenses to insert for every due, unapplied occurrence (pure; exported for tests). */
export function materializationBatch(
  snapshot: Pick<FinanceSnapshot, "recurring" | "expenses">,
  today: IsoDate,
): NewEntity<Expense>[] {
  const byId = new Map(snapshot.recurring.map((r) => [r.id, r]));
  return dueOccurrences(snapshot.recurring, snapshot.expenses, today).flatMap((o) => {
    const r = byId.get(o.recurringExpenseId);
    if (!r) return [];
    return [
      {
        amount: o.amount,
        spentOn: o.occurrenceDate,
        subcategoryId: r.subcategoryId,
        bucket: o.bucket,
        paymentAccountId: r.paymentAccountId,
        // The ledger shows the note as the description of an automatic charge.
        note: r.name,
        origin: "recurring" as const,
        recurringExpenseId: r.id,
        occurrenceDate: o.occurrenceDate,
      },
    ];
  });
}

const RECURRING_SYNC: BackgroundSync<NewEntity<Expense>[], Expense[]> = {
  plan: (snapshot, today) => {
    const batch = materializationBatch(snapshot, today);
    return batch.length > 0 ? batch : null;
  },
  write: (provider, batch) => provider.expenses.materializeRecurring(batch),
  merge: (current, inserted) => ({ ...current, expenses: appendNew(current.expenses, inserted) }),
};

export function useMaterializeRecurring(): void {
  useBackgroundSync(RECURRING_SYNC);
}
