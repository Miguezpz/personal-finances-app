"use client";

/**
 * Recurring expense hooks (T081): snapshot selectors + optimistic writes. Applied occurrences are
 * snapshots in `expenses`, so every change here only affects future charges (FR-011).
 */
import type { NewEntity, Patch } from "@/data/provider";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot, IsoDate, RecurringExpense, Uuid } from "@/domain/types";

const selectRecurring = (s: FinanceSnapshot) => s.recurring;

export function useRecurring() {
  return useFinanceSnapshot(selectRecurring);
}

const patchRecurring = (
  s: FinanceSnapshot,
  id: Uuid,
  patch: Patch<RecurringExpense>,
): FinanceSnapshot => ({
  ...s,
  recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});

export function useCreateRecurring() {
  return useSnapshotMutation<NewEntity<RecurringExpense>, RecurringExpense>({
    mutationFn: (provider, input) => provider.recurring.create(input),
    optimistic: (s, input, { tempId }) => ({
      ...s,
      recurring: [...s.recurring, { ...input, id: tempId }],
    }),
    created: (s, row, { tempId }) => ({ ...s, recurring: replaceTemp(s.recurring, tempId, row) }),
  });
}

export function useUpdateRecurring() {
  return useSnapshotMutation<{ id: Uuid; patch: Patch<RecurringExpense> }, RecurringExpense>({
    mutationFn: (provider, { id, patch }) => provider.recurring.update(id, patch),
    optimistic: (s, { id, patch }) => patchRecurring(s, id, patch),
  });
}

/** Pause: no charge after `endedOn` (inclusive bound). */
export function usePauseRecurring() {
  return useSnapshotMutation<{ id: Uuid; endedOn: IsoDate }, void>({
    mutationFn: (provider, { id, endedOn }) => provider.recurring.end(id, endedOn),
    optimistic: (s, { id, endedOn }) => patchRecurring(s, id, { endedOn }),
  });
}

/**
 * Resume from `today`: moving startsOn forward means the paused months are NOT charged
 * retroactively (charges before today stay skipped; the month-level idempotency prevents a
 * second charge in a month that was already applied).
 */
export function useResumeRecurring() {
  return useSnapshotMutation<{ id: Uuid; today: IsoDate }, RecurringExpense>({
    mutationFn: (provider, { id, today }) =>
      provider.recurring.update(id, { startsOn: today, endedOn: null }),
    optimistic: (s, { id, today }) => patchRecurring(s, id, { startsOn: today, endedOn: null }),
  });
}

/** Delete: its applied charges stay in the history (the FK only clears the reference). */
export function useDeleteRecurring() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.recurring.remove(id),
    optimistic: (s, id) => ({
      ...s,
      recurring: s.recurring.filter((r) => r.id !== id),
      expenses: s.expenses.map((e) =>
        e.recurringExpenseId === id ? { ...e, recurringExpenseId: null } : e,
      ),
    }),
  });
}
