/**
 * Spec 009 · US2: delete with Undo (research.md R3). The row disappears at once from every
 * snapshot reader; Undo brings it back without calling the server; after the toast's 6 s the
 * delete is committed; a failure restores it; the read-only demo never hides it.
 */
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { cents } from "@/domain/money";
import type { FinanceSnapshot } from "@/domain/types";
import { UNDO_TOAST_MS } from "@/features/expenses/quick-expense-hooks";
import { useDeferredDelete } from "@/features/shared/use-deferred-delete";
import { usePendingDeletes } from "@/store/pending-deletes";
import { emptySnapshot, makeExpense } from "../../utils/fixtures";
import { createMemoryProvider } from "../../utils/memory-provider";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

const coffee = makeExpense({ amount: cents(5_000), note: "Coffee" });
const snapshot = (): FinanceSnapshot => emptySnapshot({ expenses: [coffee] });
const selectIds = (s: FinanceSnapshot) => s.expenses.map((e) => e.id);

function useHarness() {
  const { remove } = useDeferredDelete();
  const { data } = useFinanceSnapshot(selectIds);
  return { remove, ids: data };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
  usePendingDeletes.setState({ entries: [] });
});
afterEach(() => vi.useRealTimers());

describe("useDeferredDelete", () => {
  it("hides at once, Undo restores without calling the server", async () => {
    const provider = createMemoryProvider(snapshot());
    const { result } = renderHookWithProviders(useHarness, { provider });
    await waitFor(() => expect(result.current.ids).toEqual([coffee.id]));

    act(() => result.current.remove({ kind: "expense", id: coffee.id, label: "Deleted" }));
    expect(result.current.ids).toEqual([]);

    // Undo = dropping the pending entry (what the toast's action does).
    act(() => usePendingDeletes.getState().remove(`expense:${coffee.id}`));
    expect(result.current.ids).toEqual([coffee.id]);
    expect(provider.expenses.remove).not.toHaveBeenCalled();
  });

  it("commits the delete when the Undo window closes", async () => {
    const provider = createMemoryProvider(snapshot());
    const { result } = renderHookWithProviders(useHarness, { provider });
    await waitFor(() => expect(result.current.ids).toEqual([coffee.id]));

    act(() => result.current.remove({ kind: "expense", id: coffee.id, label: "Deleted" }));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_TOAST_MS);
    });
    await waitFor(() => expect(provider.expenses.remove).toHaveBeenCalledWith(coffee.id));
    expect(provider.state.snapshot.expenses).toEqual([]);
    expect(usePendingDeletes.getState().entries).toEqual([]);
    expect(result.current.ids).toEqual([]);
  });

  it("restores the row when the delete fails", async () => {
    const provider = createMemoryProvider(snapshot());
    provider.expenses.remove.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHookWithProviders(useHarness, { provider });
    await waitFor(() => expect(result.current.ids).toEqual([coffee.id]));

    act(() => result.current.remove({ kind: "expense", id: coffee.id, label: "Deleted" }));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_TOAST_MS);
    });
    await waitFor(() => expect(provider.expenses.remove).toHaveBeenCalled());
    await waitFor(() => expect(result.current.ids).toEqual([coffee.id]));
  });

  it("the read-only demo never hides the row", async () => {
    const provider = createMockProvider({ snapshot: snapshot() });
    const { result } = renderHookWithProviders(useHarness, { provider });
    await waitFor(() => expect(result.current.ids).toEqual([coffee.id]));

    act(() => result.current.remove({ kind: "expense", id: coffee.id, label: "Deleted" }));
    expect(result.current.ids).toEqual([coffee.id]);
    expect(usePendingDeletes.getState().entries).toEqual([]);
  });
});
