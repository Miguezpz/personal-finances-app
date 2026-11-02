"use client";

/**
 * Background materialization of recurring charges (T082, FR-010, research.md R5).
 *
 * When domain data loads (and on every later load), compute the due occurrences and insert them as
 * `expenses` (origin 'recurring'). No server cron (Principle I): it runs when the app opens.
 *  - Idempotent: the domain only proposes missing months, and the DB's unique key turns a
 *    concurrent insert from another tab into a no-op.
 *  - One run at a time per tab; a failure (offline / cold start) is retried on the next load.
 *  - A background process: it only runs when `provider.capabilities.canWrite` — in the demo it
 *    does nothing and shows nothing (FR-047a).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDataProvider } from "@/data/context";
import type { NewEntity } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { dueOccurrences } from "@/domain/recurring";
import type { Expense, FinanceSnapshot, IsoDate } from "@/domain/types";
import { useToday } from "@/lib/use-today";

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

export function useMaterializeRecurring(): void {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const today = useToday();
  const { data: snapshot, dataUpdatedAt } = useFinanceSnapshot();
  const running = useRef(false);
  const canWrite = provider.capabilities.canWrite;

  useEffect(() => {
    if (!canWrite || !snapshot || running.current) return;
    const batch = materializationBatch(snapshot, today);
    if (batch.length === 0) return;

    running.current = true;
    provider.expenses
      .materializeRecurring(batch)
      .then((inserted) => {
        if (inserted.length === 0) return;
        // Server-confirmed rows: merge them into the single cache (no refetch needed).
        queryClient.setQueryData<FinanceSnapshot>(queryKeys.snapshot, (current) => {
          if (!current) return current;
          const known = new Set(current.expenses.map((e) => e.id));
          return {
            ...current,
            expenses: [...current.expenses, ...inserted.filter((e) => !known.has(e.id))],
          };
        });
      })
      .catch(() => {
        // Transient (offline / cold start): retried on the next successful load.
      })
      .finally(() => {
        running.current = false;
      });
    // dataUpdatedAt: a refetch that returns identical data still deserves a retry after a failure.
  }, [canWrite, provider, queryClient, snapshot, dataUpdatedAt, today]);
}
