"use client";

/**
 * Writes against the single domain cache (T158, research.md R17):
 *   onMutate  → optimistic change applied to queryKeys.snapshot (the UI updates at once, SC-004)
 *   onSuccess → for creates, `created` swaps the temporary id for the server's row right away, so
 *               editing a just-created row targets the real one (before, it kept the temporary id
 *               until the refetch landed, and an edit in that window was rejected as NOT_FOUND)
 *   onError   → rollback to the exact previous snapshot (also for DemoReadOnlyError)
 *   onSettled → invalidate queryKeys.snapshot to reconcile with the provider's truth
 * Offline, a write fails at once with ProviderError('OFFLINE') and changes nothing (no optimistic
 * row that looks saved but isn't); the global offline toast explains it.
 */
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { FinanceSnapshot, Uuid } from "@/domain/types";
import { isBrowserOffline } from "@/lib/network";
import { useDataProvider } from "./context";
import { ProviderError, type DataProvider } from "./provider";
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

/** Per-mutation data shared by `optimistic` and `created`. */
export interface OptimisticContext {
  /** Id to give the optimistic row of a create; `created` replaces it with the server's. */
  readonly tempId: Uuid;
}

export interface SnapshotMutationOptions<TVariables, TData> {
  /** The write; receives the active provider (never import a concrete provider in features). */
  mutationFn: (provider: DataProvider, variables: TVariables) => Promise<TData>;
  /** Pure optimistic change to the snapshot. Omit for writes whose effect can't be predicted. */
  optimistic?: (
    snapshot: FinanceSnapshot,
    variables: TVariables,
    context: OptimisticContext,
  ) => FinanceSnapshot;
  /**
   * Creates only: applied as soon as the write succeeds (before the refetch) to put the server's
   * row in place of the optimistic one that used `context.tempId`.
   */
  created?: (snapshot: FinanceSnapshot, data: TData, context: OptimisticContext) => FinanceSnapshot;
  /**
   * Called after the rollback when the write fails (spec 009, FR-008). Mutation-level, so it runs
   * even when the dialog that started the save has already closed — "Retry" needs that.
   */
  onFailure?: (error: Error, variables: TVariables) => void;
}

interface MutationContext extends OptimisticContext {
  rollback: Rollback;
}

/** Replaces the row whose id is `tempId` with the server's row (no-op if it isn't there). */
export function replaceTemp<T extends { id: Uuid }>(list: readonly T[], tempId: Uuid, row: T): T[] {
  return list.map((x) => (x.id === tempId ? row : x));
}

export function useSnapshotMutation<TVariables, TData = unknown>(
  options: SnapshotMutationOptions<TVariables, TData>,
): UseMutationResult<TData, Error, TVariables, MutationContext> {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const { mutationFn, optimistic, created, onFailure } = options;

  return useMutation<TData, Error, TVariables, MutationContext>({
    mutationFn: (variables) =>
      isBrowserOffline()
        ? Promise.reject(new ProviderError("OFFLINE", "No connection: the write was not sent"))
        : mutationFn(provider, variables),
    onMutate: async (variables) => {
      const tempId = crypto.randomUUID() as Uuid;
      return {
        tempId,
        rollback:
          optimistic && !isBrowserOffline()
            ? await updateSnapshot(queryClient, (s) => optimistic(s, variables, { tempId }))
            : () => {},
      };
    },
    onSuccess: (data, _variables, context) => {
      if (!created || !context) return;
      const current = queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot);
      if (current !== undefined) {
        queryClient.setQueryData<FinanceSnapshot>(
          queryKeys.snapshot,
          created(current, data, { tempId: context.tempId }),
        );
      }
    },
    onError: (error, variables, context) => {
      context?.rollback();
      onFailure?.(error, variables);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.snapshot }),
  });
}
