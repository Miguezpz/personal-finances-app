"use client";

/** Goal hooks (T145): selectors + optimistic writes over the snapshot. */
import type { NewEntity, Patch } from "@/data/provider";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot, Goal, Uuid } from "@/domain/types";

const selectGoalData = (s: FinanceSnapshot) => ({
  goals: s.goals,
  contributions: s.contributions,
  expenses: s.expenses,
});

export function useGoalData() {
  return useFinanceSnapshot(selectGoalData);
}

export function useCreateGoal() {
  return useSnapshotMutation<NewEntity<Goal>, Goal>({
    mutationFn: (provider, input) => provider.goals.create(input),
    optimistic: (s, input, { tempId }) => ({
      ...s,
      goals: [...s.goals, { ...input, id: tempId }],
    }),
    created: (s, row, { tempId }) => ({ ...s, goals: replaceTemp(s.goals, tempId, row) }),
  });
}

/** Edit, archive (pauses its contributions) or restore. */
export function useUpdateGoal() {
  return useSnapshotMutation<{ id: Uuid; patch: Patch<Goal> }, Goal>({
    mutationFn: (provider, { id, patch }) => provider.goals.update(id, patch),
    optimistic: (s, { id, patch }) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }),
  });
}
