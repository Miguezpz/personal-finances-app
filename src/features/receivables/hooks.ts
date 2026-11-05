"use client";

/**
 * Receivable hooks (T098): snapshot selectors + optimistic writes. Collections only change what
 * the debtor owes — never a bucket (FR-026a).
 */
import type { CreateReceivableInput, NewEntity, RecordCollectionInput } from "@/data/provider";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { installmentStatusFor } from "@/domain/installments";
import type { Debtor, FinanceSnapshot, Installment, Receivable, Uuid } from "@/domain/types";

const selectReceivableData = (s: FinanceSnapshot) => ({
  debtors: s.debtors,
  receivables: s.receivables,
  installments: s.installments,
  cards: s.accounts.filter((a) => a.kind === "credit_card"),
});

export function useReceivables() {
  return useFinanceSnapshot(selectReceivableData);
}

const tempId = () => crypto.randomUUID() as Uuid;

export function useCreateDebtor() {
  return useSnapshotMutation<NewEntity<Debtor>, Debtor>({
    mutationFn: (provider, input) => provider.receivables.createDebtor(input),
    optimistic: (s, input, { tempId: id }) => ({ ...s, debtors: [...s.debtors, { ...input, id }] }),
    created: (s, debtor, { tempId: id }) => ({ ...s, debtors: replaceTemp(s.debtors, id, debtor) }),
  });
}

export function useCreateReceivable() {
  return useSnapshotMutation<CreateReceivableInput, Receivable>({
    mutationFn: (provider, input) => provider.receivables.create(input),
    optimistic: (s, { receivable, installments }, { tempId: id }) => {
      return {
        ...s,
        receivables: [...s.receivables, { ...receivable, id }],
        installments: [
          ...s.installments,
          ...installments.map((i): Installment => ({
            ...i,
            id: tempId(),
            receivableId: id,
            collected: 0 as Installment["collected"],
            collectedOn: null,
            status: "pending",
          })),
        ],
      };
    },
    // The receivable gets its server id at once; its installments keep temporary ids until the
    // refetch (the create RPC only returns the header).
    created: (s, row, { tempId: id }) => ({
      ...s,
      receivables: replaceTemp(s.receivables, id, row),
      installments: s.installments.map((i) =>
        i.receivableId === id ? { ...i, receivableId: row.id } : i,
      ),
    }),
  });
}

export function useRecordCollection() {
  return useSnapshotMutation<RecordCollectionInput, Installment>({
    mutationFn: (provider, input) => provider.receivables.recordCollection(input),
    optimistic: (s, { installmentId, collected, collectedOn }) => ({
      ...s,
      installments: s.installments.map((i) =>
        i.id === installmentId
          ? {
              ...i,
              collected,
              collectedOn: collected > 0 ? collectedOn : null,
              status: installmentStatusFor(collected, i.amount),
            }
          : i,
      ),
    }),
  });
}
