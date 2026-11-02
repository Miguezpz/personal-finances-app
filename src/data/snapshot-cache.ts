"use client";

/**
 * Writes against the single domain cache (T158, research.md R17):
 *   onMutate  → optimistic change applied to queryKeys.snapshot (the UI updates at once, SC-004)
 *   onError   → rollback to the exact previous snapshot (also for DemoReadOnlyError)
 *   onSettled → invalidate queryKeys.snapshot to reconcile with the provider's truth
 */
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { FinanceSnapshot } from "@/domain/types";
import { useDataProvider } from "./context";
import type { DataProvider } from "./provider";
import { queryKeys } from "./query-keys";

export type Rollback = () => void;

/**
 * Applies `updater` to the cached snapshot (if loaded) and returns a function that restores the
 * previous value. In-flight snapshot fetches are cancelled so they can't overwrite the change.
 */
export async function updateSnapshot(
  queryClient: QueryClient,
  updater: (snapshot: FinanceSnapshot) => FinanceSnapshot,
): Promise<Rollback> {
  await queryClient.cancelQueries({ queryKey: queryKeys.snapshot });
  const previous = queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot);
  if (previous === undefined) return () => {};
  queryClient.setQueryData<FinanceSnapshot>(queryKeys.snapshot, updater(previous));
  return () => queryClient.setQueryData<FinanceSnapshot>(queryKeys.snapshot, previous);
}

export interface SnapshotMutationOptions<TVariables, TData> {
  /** The write; receives the active provider (never import a concrete provider in features). */
  mutationFn: (provider: DataProvider, variables: TVariables) => Promise<TData>;
  /** Pure optimistic change to the snapshot. Omit for writes whose effect can't be predicted. */
  optimistic?: (snapshot: FinanceSnapshot, variables: TVariables) => FinanceSnapshot;
}

interface MutationContext {
  rollback: Rollback;
}

export function useSnapshotMutation<TVariables, TData = unknown>(
  options: SnapshotMutationOptions<TVariables, TData>,
): UseMutationResult<TData, Error, TVariables, MutationContext> {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const { mutationFn, optimistic } = options;

  return useMutation<TData, Error, TVariables, MutationContext>({
    mutationFn: (variables) => mutationFn(provider, variables),
    onMutate: async (variables) => ({
      rollback: optimistic
        ? await updateSnapshot(queryClient, (s) => optimistic(s, variables))
        : () => {},
    }),
    onError: (_error, _variables, context) => {
      context?.rollback();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.snapshot }),
  });
}
