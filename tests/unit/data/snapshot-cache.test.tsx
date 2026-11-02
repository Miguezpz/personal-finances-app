/**
 * T159 · The single domain cache (research.md R17): optimistic update before the provider
 * answers, rollback on failure (including DemoReadOnlyError), reconciliation by invalidating
 * queryKeys.snapshot, and per-aggregate selectors that reflect changes instantly.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataProviderProvider } from "@/data/context";
import { createMockProvider } from "@/data/mock/provider";
import { DemoReadOnlyError, type DataProvider } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { useSnapshotMutation } from "@/data/snapshot-cache";
import { selectExpenses, useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { Expense, FinanceSnapshot } from "@/domain/types";
import { emptySnapshot, makeExpense } from "../../utils/fixtures";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(initial: FinanceSnapshot) {
  const provider: DataProvider = createMockProvider({ snapshot: initial });
  const loadSnapshot = vi.spyOn(provider, "loadSnapshot");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DataProviderProvider provider={provider}>{children}</DataProviderProvider>
    </QueryClientProvider>
  );
  return { provider, queryClient, loadSnapshot, invalidate, wrapper };
}

/** Renders a selector over the snapshot and a mutation that adds an expense. */
function useHarness(mutationFn: (e: Expense) => Promise<Expense>) {
  const expenses = useFinanceSnapshot(selectExpenses);
  const add = useSnapshotMutation<Expense, Expense>({
    mutationFn: (_provider, e) => mutationFn(e),
    optimistic: (s, e) => ({ ...s, expenses: [...s.expenses, e] }),
  });
  return { expenses, add };
}

describe("useFinanceSnapshot", () => {
  it("loads the snapshot once and serves aggregates as selectors", async () => {
    const existing = makeExpense();
    const { wrapper, loadSnapshot } = setup(emptySnapshot({ expenses: [existing] }));
    const { result } = renderHook(
      () => ({ a: useFinanceSnapshot(selectExpenses), b: useFinanceSnapshot((s) => s.incomes) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.a.data).toEqual([existing]));
    expect(result.current.b.data).toEqual([]);
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("useSnapshotMutation / updateSnapshot", () => {
  it("applies the change optimistically before the provider answers, then reconciles", async () => {
    const pending = deferred<Expense>();
    const { wrapper, invalidate, loadSnapshot } = setup(emptySnapshot());
    const { result } = renderHook(() => useHarness(() => pending.promise), { wrapper });
    await waitFor(() => expect(result.current.expenses.data).toEqual([]));

    const added = makeExpense();
    act(() => result.current.add.mutate(added));

    // Visible immediately, while the write is still in flight (SC-004).
    await waitFor(() => expect(result.current.expenses.data).toEqual([added]));
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve(added);
      await pending.promise;
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.snapshot }));
    await waitFor(() => expect(loadSnapshot).toHaveBeenCalledTimes(2)); // refetch = reconciliation
  });

  it("rolls back to the previous state when the write fails", async () => {
    const existing = makeExpense();
    const { wrapper, invalidate } = setup(emptySnapshot({ expenses: [existing] }));
    const pending = deferred<Expense>();
    const { result } = renderHook(() => useHarness(() => pending.promise), { wrapper });
    await waitFor(() => expect(result.current.expenses.data).toEqual([existing]));

    act(() => result.current.add.mutate(makeExpense()));
    await waitFor(() => expect(result.current.expenses.data).toHaveLength(2));

    await act(async () => {
      pending.reject(new Error("network down"));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.add.isError).toBe(true));
    expect(result.current.expenses.data).toEqual([existing]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.snapshot });
  });

  it("rolls back a DemoReadOnlyError from the demo provider", async () => {
    const existing = makeExpense();
    const { wrapper, provider } = setup(emptySnapshot({ expenses: [existing] }));
    const { result } = renderHook(() => useHarness((e) => provider.expenses.create(e)), {
      wrapper,
    });
    await waitFor(() => expect(result.current.expenses.data).toEqual([existing]));

    act(() => result.current.add.mutate(makeExpense()));
    await waitFor(() => expect(result.current.add.isError).toBe(true));
    expect(result.current.add.error).toBeInstanceOf(DemoReadOnlyError);
    expect(result.current.expenses.data).toEqual([existing]);
  });

  it("does nothing optimistic before the snapshot has loaded", async () => {
    const { queryClient, wrapper } = setup(emptySnapshot());
    const { result } = renderHook(
      () =>
        useSnapshotMutation<Expense, Expense>({
          mutationFn: async (_p, e) => e,
          optimistic: (s, e) => ({ ...s, expenses: [...s.expenses, e] }),
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync(makeExpense());
    });
    // No cached snapshot to update: the next load brings the server truth.
    expect(queryClient.getQueryData(queryKeys.snapshot)).toBeUndefined();
  });
});
