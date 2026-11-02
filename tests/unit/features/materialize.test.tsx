/**
 * T079 · useMaterializeRecurring: applies only the missing occurrences, never runs twice at the
 * same time, a retry after a failure doesn't duplicate (unique index simulated by the memory
 * provider), and it does nothing when the provider can't write (demo, FR-047a).
 */
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import { queryKeys } from "@/data/query-keys";
import { cents } from "@/domain/money";
import type { Expense, FinanceSnapshot } from "@/domain/types";
import {
  materializationBatch,
  useMaterializeRecurring,
} from "@/features/recurring/useMaterializeRecurring";
import { d, emptySnapshot, makeExpense, makeRecurring } from "../../utils/fixtures";
import { createMemoryProvider, failOnce } from "../../utils/memory-provider";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

const rent = makeRecurring({
  name: "Rent",
  amount: cents(800_000),
  chargeDay: 5,
  bucket: "needs",
  paymentAccountId: null,
  startsOn: d("2026-09-01"),
});

const appliedSept = makeExpense({
  amount: rent.amount,
  spentOn: d("2026-09-05"),
  bucket: "needs",
  subcategoryId: rent.subcategoryId,
  origin: "recurring",
  recurringExpenseId: rent.id,
  occurrenceDate: d("2026-09-05"),
});

const snapshot = (): FinanceSnapshot =>
  emptySnapshot({ recurring: [rent], expenses: [appliedSept] });
const recurringDates = (expenses: readonly Expense[]) =>
  expenses
    .filter((e) => e.origin === "recurring")
    .map((e) => e.occurrenceDate)
    .sort();

beforeEach(() => {
  // Only the clock: promises and timers stay real.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T18:00:00Z")); // Nov 10 in Mexico City
});
afterEach(() => vi.useRealTimers());

describe("materializationBatch", () => {
  it("builds one manual-looking expense per due occurrence, labelled with the recurring name", () => {
    const batch = materializationBatch(snapshot(), d("2026-11-10"));
    expect(batch).toEqual([
      expect.objectContaining({
        spentOn: "2026-10-05",
        occurrenceDate: "2026-10-05",
        origin: "recurring",
        note: "Rent",
        amount: 800_000,
        bucket: "needs",
        subcategoryId: rent.subcategoryId,
      }),
      expect.objectContaining({ spentOn: "2026-11-05", occurrenceDate: "2026-11-05" }),
    ]);
  });
});

describe("useMaterializeRecurring", () => {
  it("inserts only the missing occurrences, once, and updates the cache", async () => {
    const provider = createMemoryProvider(snapshot());
    const { queryClient } = renderHookWithProviders(() => useMaterializeRecurring(), { provider });

    await waitFor(() => expect(provider.expenses.materializeRecurring).toHaveBeenCalledTimes(1));
    expect(recurringDates(provider.state.snapshot.expenses)).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
    await waitFor(() =>
      expect(
        recurringDates(
          queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot)?.expenses ?? [],
        ),
      ).toEqual(["2026-09-05", "2026-10-05", "2026-11-05"]),
    );

    // A later refetch finds nothing due: no second insert.
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
    });
    expect(provider.expenses.materializeRecurring).toHaveBeenCalledTimes(1);
  });

  it("never runs two materializations at the same time", async () => {
    const provider = createMemoryProvider(snapshot());
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = provider.expenses.materializeRecurring.getMockImplementation();
    provider.expenses.materializeRecurring.mockImplementation(async (items) => {
      await gate;
      return real ? real(items) : [];
    });

    const { queryClient } = renderHookWithProviders(() => useMaterializeRecurring(), { provider });
    await waitFor(() => expect(provider.expenses.materializeRecurring).toHaveBeenCalledTimes(1));

    // The snapshot changes while the first run is still in flight.
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
    });
    expect(provider.expenses.materializeRecurring).toHaveBeenCalledTimes(1);

    await act(async () => release());
    await waitFor(() => expect(recurringDates(provider.state.snapshot.expenses)).toHaveLength(3));
  });

  it("a retry after a failure applies everything exactly once", async () => {
    const provider = createMemoryProvider(snapshot());
    failOnce(provider.expenses.materializeRecurring);
    const { queryClient } = renderHookWithProviders(() => useMaterializeRecurring(), { provider });

    await waitFor(() => expect(provider.expenses.materializeRecurring).toHaveBeenCalledTimes(1));
    expect(recurringDates(provider.state.snapshot.expenses)).toEqual(["2026-09-05"]);

    // Next load (e.g. back online, a few seconds later) retries.
    vi.setSystemTime(new Date("2026-11-10T18:00:05Z"));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
    });
    await waitFor(() => expect(provider.expenses.materializeRecurring).toHaveBeenCalledTimes(2));
    expect(recurringDates(provider.state.snapshot.expenses)).toEqual([
      "2026-09-05",
      "2026-10-05",
      "2026-11-05",
    ]);
  });

  it("does nothing (and writes nothing) when the provider can't write", async () => {
    const provider = createMockProvider({ snapshot: snapshot() });
    const spy = vi.spyOn(provider.expenses, "materializeRecurring");
    const { queryClient } = renderHookWithProviders(() => useMaterializeRecurring(), { provider });
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.snapshot)).toBeDefined());
    expect(spy).not.toHaveBeenCalled();
  });
});
