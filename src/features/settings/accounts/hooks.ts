"use client";

/**
 * Account catalog hooks (T122): selectors + optimistic writes over the snapshot. Archived
 * accounts stay in the snapshot (history keeps pointing at them) and can be restored.
 *
 * Spec 007: changing a card's cut-off day or days to pay also reschedules its not-collected MSI
 * installments, in the same write (FR-011, FR-012).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { NewEntity, Patch } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { rescheduleCardInstallments, type InstallmentDates } from "@/domain/card-terms";
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
    optimistic: (s, input, { tempId }) => ({
      ...s,
      accounts: [...s.accounts, { ...input, id: tempId }],
    }),
    created: (s, row, { tempId }) => ({ ...s, accounts: replaceTemp(s.accounts, tempId, row) }),
  });
}

/** Applies new installment dates to the snapshot (optimistic update and background merge). */
export function applyInstallmentDates(
  s: FinanceSnapshot,
  dates: readonly InstallmentDates[],
): FinanceSnapshot {
  if (dates.length === 0) return s;
  const byId = new Map(dates.map((x) => [x.id, x]));
  return {
    ...s,
    installments: s.installments.map((i) => {
      const next = byId.get(i.id);
      return next ? { ...i, dueOn: next.dueOn, cardDueOn: next.cardDueOn } : i;
    }),
  };
}

/** Installments to reschedule when `patch` changes the card's terms; [] otherwise (US3-4). */
export function rescheduleForPatch(
  s: Pick<FinanceSnapshot, "accounts" | "receivables" | "installments" | "settings">,
  id: Uuid,
  patch: Patch<Account>,
): InstallmentDates[] {
  const account = s.accounts.find((a) => a.id === id);
  if (!account) return [];
  const changes = (key: "cutOffDay" | "paymentDueOffsetDays") =>
    patch[key] !== undefined && patch[key] !== account[key];
  if (!changes("cutOffDay") && !changes("paymentDueOffsetDays")) return [];
  return rescheduleCardInstallments(
    { ...account, ...patch },
    s.receivables,
    s.installments,
    s.settings.collectionLeadDays,
  );
}

interface UpdateAccountVariables {
  id: Uuid;
  patch: Patch<Account>;
  reschedule?: readonly InstallmentDates[];
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const mutation = useSnapshotMutation<UpdateAccountVariables, Account>({
    mutationFn: (provider, { id, patch, reschedule }) =>
      provider.accounts.update(id, patch, reschedule),
    optimistic: (s, { id, patch, reschedule = [] }) =>
      applyInstallmentDates(patchAccount(s, id, patch), reschedule),
  });
  const { mutate: send } = mutation;
  // The plan is computed from the snapshot BEFORE the optimistic update.
  const mutate = useCallback<typeof send>(
    (variables, options) => {
      const s = queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot);
      const reschedule =
        variables.reschedule ?? (s ? rescheduleForPatch(s, variables.id, variables.patch) : []);
      send({ ...variables, reschedule }, options);
    },
    [queryClient, send],
  );
  return { ...mutation, mutate };
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
