"use client";

/**
 * Expense and card-payment hooks (T090). Reads are snapshot selectors; writes are optimistic,
 * so the Safe-to-Spend changes the instant an expense is saved (FR-018, SC-004).
 */
import type { NewEntity, Patch } from "@/data/provider";
import { useSnapshotMutation } from "@/data/snapshot-cache";
import type { CardPayment, Expense, FinanceSnapshot, SpendBucket, Uuid } from "@/domain/types";

/** Bucket inherited from the subcategory's parent category (FR-014). */
export function bucketOfSubcategory(
  s: Pick<FinanceSnapshot, "categories" | "subcategories">,
  subcategoryId: Uuid,
): SpendBucket | null {
  const sub = s.subcategories.find((x) => x.id === subcategoryId);
  return s.categories.find((c) => c.id === sub?.categoryId)?.macro ?? null;
}

export function useCreateExpense() {
  return useSnapshotMutation<NewEntity<Expense>, Expense>({
    mutationFn: (provider, input) => provider.expenses.create(input),
    optimistic: (s, input) => ({
      ...s,
      expenses: [...s.expenses, { ...input, id: crypto.randomUUID() as Uuid }],
    }),
  });
}

export function useUpdateExpense() {
  return useSnapshotMutation<{ id: Uuid; patch: Patch<Expense> }, Expense>({
    mutationFn: (provider, { id, patch }) => provider.expenses.update(id, patch),
    optimistic: (s, { id, patch }) => ({
      ...s,
      expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }),
  });
}

export function useDeleteExpense() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.expenses.remove(id),
    optimistic: (s, id) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }),
  });
}

// ---------------------------------------------------------------------------
// Card payments: debt settlements that never touch Needs/Wants (FR-013b)
// ---------------------------------------------------------------------------
export function useCreateCardPayment() {
  return useSnapshotMutation<NewEntity<CardPayment>, CardPayment>({
    mutationFn: (provider, input) => provider.cardPayments.create(input),
    optimistic: (s, input) => ({
      ...s,
      cardPayments: [...s.cardPayments, { ...input, id: crypto.randomUUID() as Uuid }],
    }),
  });
}

export function useDeleteCardPayment() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.cardPayments.remove(id),
    optimistic: (s, id) => ({ ...s, cardPayments: s.cardPayments.filter((p) => p.id !== id) }),
  });
}
