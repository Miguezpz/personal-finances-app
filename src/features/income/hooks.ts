"use client";

/**
 * Income hooks (T062). Reads are selectors over the single snapshot; writes go through
 * useSnapshotMutation, so the UI updates optimistically and reconciles with the provider.
 */
import type { RegisterIncomeInput } from "@/data/provider";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot, Income, IncomeAllocation, Uuid } from "@/domain/types";

export interface IncomeData {
  incomes: readonly Income[];
  allocations: readonly IncomeAllocation[];
}

const selectIncomeData = (s: FinanceSnapshot): IncomeData => ({
  incomes: s.incomes,
  allocations: s.allocations,
});

export function useIncomes() {
  return useFinanceSnapshot(selectIncomeData);
}

const tempId = () => crypto.randomUUID() as Uuid;

function withIncome(s: FinanceSnapshot, id: Uuid, input: RegisterIncomeInput): FinanceSnapshot {
  const income: Income = { ...input.income, id };
  const allocations: IncomeAllocation[] = input.allocations.map((a) => ({
    ...a,
    id: tempId(),
    incomeId: id,
  }));
  return {
    ...s,
    incomes: [...s.incomes.filter((i) => i.id !== id), income],
    allocations: [...s.allocations.filter((a) => a.incomeId !== id), ...allocations],
  };
}

export function withoutIncome(s: FinanceSnapshot, id: Uuid): FinanceSnapshot {
  return {
    ...s,
    incomes: s.incomes.filter((i) => i.id !== id),
    allocations: s.allocations.filter((a) => a.incomeId !== id),
  };
}

export function useRegisterIncome() {
  return useSnapshotMutation<RegisterIncomeInput, Income>({
    mutationFn: (provider, input) => provider.incomes.register(input),
    optimistic: (s, input, { tempId: id }) => withIncome(s, id, input),
    // The server's income replaces the temporary one, and its allocations point to the real id.
    created: (s, income, { tempId: id }) => ({
      ...s,
      incomes: replaceTemp(s.incomes, id, income),
      allocations: s.allocations.map((a) =>
        a.incomeId === id ? { ...a, incomeId: income.id } : a,
      ),
    }),
  });
}

export function useReplaceIncome() {
  return useSnapshotMutation<{ id: Uuid; input: RegisterIncomeInput }, Income>({
    mutationFn: (provider, { id, input }) => provider.incomes.replace(id, input),
    optimistic: (s, { id, input }) => withIncome(s, id, input),
  });
}

export function useDeleteIncome() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.incomes.remove(id),
    optimistic: withoutIncome,
  });
}
