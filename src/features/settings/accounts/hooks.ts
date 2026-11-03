"use client";

/**
 * Account catalog hooks (T122): selectors + optimistic writes over the snapshot. Archived
 * accounts stay in the snapshot (history keeps pointing at them) and can be restored.
 */
import type { NewEntity, Patch } from "@/data/provider";
import { useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { Account, FinanceSnapshot, Uuid } from "@/domain/types";

const selectAccounts = (s: FinanceSnapshot) => s.accounts;

export function useAccounts() {
  return useFinanceSnapshot(selectAccounts);
}

const patchAccount = (s: FinanceSnapshot, id: Uuid, patch: Patch<Account>): FinanceSnapshot => ({
  ...s,
  accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
});

export function useCreateAccount() {
  return useSnapshotMutation<NewEntity<Account>, Account>({
    mutationFn: (provider, input) => provider.accounts.create(input),
    optimistic: (s, input) => ({
      ...s,
      accounts: [...s.accounts, { ...input, id: crypto.randomUUID() as Uuid }],
    }),
  });
}

export function useUpdateAccount() {
  return useSnapshotMutation<{ id: Uuid; patch: Patch<Account> }, Account>({
    mutationFn: (provider, { id, patch }) => provider.accounts.update(id, patch),
    optimistic: (s, { id, patch }) => patchAccount(s, id, patch),
  });
}

/** Rejects with CONFLICT when the card still has pending third-party installments (edge case). */
export function useArchiveAccount() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.accounts.archive(id),
    optimistic: (s, id) => patchAccount(s, id, { archived: true }),
  });
}

export function useRestoreAccount() {
  return useSnapshotMutation<Uuid, Account>({
    mutationFn: (provider, id) => provider.accounts.update(id, { archived: false }),
    optimistic: (s, id) => patchAccount(s, id, { archived: false }),
  });
}

/** Same check the provider runs, used to explain up front why a card can't be archived. */
export function hasPendingInstallments(
  s: Pick<FinanceSnapshot, "receivables" | "installments">,
  cardId: Uuid,
) {
  const receivableIds = new Set(
    s.receivables.filter((r) => r.cardAccountId === cardId).map((r) => r.id),
  );
  return s.installments.some((n) => receivableIds.has(n.receivableId) && n.status !== "collected");
}
