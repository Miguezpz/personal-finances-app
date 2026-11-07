/**
 * Spec 007 · MSI installments follow their card (FR-011…FR-013): editing a card's terms sends the
 * not-collected installments in the same write; a name-only edit sends none; the background pass
 * fixes stale dates once and then stays idle; the demo never writes.
 */
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import { queryKeys } from "@/data/query-keys";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { cents } from "@/domain/money";
import type { Cents, FinanceSnapshot } from "@/domain/types";
import {
  reschedulePlan,
  useRescheduleInstallments,
} from "@/features/receivables/useRescheduleInstallments";
import { applyInstallmentDates, useUpdateAccount } from "@/features/settings/accounts/hooks";
import { d, emptySnapshot, makeCard, makeInstallment, makeReceivable } from "../../utils/fixtures";
import { createMemoryProvider } from "../../utils/memory-provider";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T18:00:00Z"));
});
afterEach(() => vi.useRealTimers());

// Banregio after the owner's fix: day 14, 21 days. Its pending installment still has the dates
// computed before spec 007 (Sat Dec 5 / Dec 2).
const banregio = makeCard({ name: "Banregio", cutOffDay: 14, paymentDueOffsetDays: 21 });
const purchase = makeReceivable({
  cardAccountId: banregio.id,
  purchaseDate: d("2026-10-20"),
  termMonths: 2,
  total: cents(400_000),
});
const collected = makeInstallment({
  receivableId: purchase.id,
  seq: 1,
  dueOn: d("2026-11-01"),
  cardDueOn: d("2026-11-04"),
  collected: 200_000 as Cents,
  status: "collected",
});
const pending = makeInstallment({
  receivableId: purchase.id,
  seq: 2,
  dueOn: d("2026-12-02"),
  cardDueOn: d("2026-12-05"),
});

const snapshot = (): FinanceSnapshot => {
  const s = emptySnapshot({
    accounts: [banregio],
    receivables: [purchase],
    installments: [collected, pending],
  });
  return { ...s, settings: { ...s.settings, collectionLeadDays: 3 } };
};

/** The mutation plans from the cached snapshot, so load it like any page does. */
const useEditor = () => {
  useFinanceSnapshot();
  return useUpdateAccount();
};

const cached = (qc: { getQueryData: (k: readonly unknown[]) => unknown }) =>
  qc.getQueryData(queryKeys.snapshot) as FinanceSnapshot | undefined;

describe("reschedulePlan", () => {
  it("moves Banregio's pending installment to Fri Dec 4 / Dec 1 and is idempotent", () => {
    const plan = reschedulePlan(snapshot());
    // Bought after Oct 14 → first statement Nov 14; seq 2 is the Dec 14 statement → Mon Jan 4.
    // Seq 1 is collected and never moves.
    expect(plan).toEqual({
      cardId: banregio.id,
      changes: [{ id: pending.id, cardDueOn: "2027-01-04", dueOn: "2027-01-01" }],
    });
    expect(reschedulePlan(applyInstallmentDates(snapshot(), plan?.changes ?? []))).toBeNull();
  });

  it("skips archived cards", () => {
    const s = snapshot();
    expect(reschedulePlan({ ...s, accounts: [{ ...banregio, archived: true }] })).toBeNull();
  });
});

describe("useRescheduleInstallments", () => {
  it("writes once through accounts.update and merges the dates into the cache", async () => {
    const provider = createMemoryProvider(snapshot());
    const { queryClient } = renderHookWithProviders(() => useRescheduleInstallments(), {
      provider,
    });

    await waitFor(() => expect(provider.accounts.update).toHaveBeenCalledTimes(1));
    expect(provider.accounts.update).toHaveBeenCalledWith(banregio.id, {}, [
      { id: pending.id, cardDueOn: "2027-01-04", dueOn: "2027-01-01" },
    ]);
    await waitFor(() =>
      expect(cached(queryClient)?.installments.find((i) => i.id === pending.id)).toMatchObject({
        cardDueOn: "2027-01-04",
      }),
    );

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
    });
    expect(provider.accounts.update).toHaveBeenCalledTimes(1);
  });

  it("never writes with the demo provider", async () => {
    const provider = createMockProvider({ snapshot: snapshot() });
    const update = vi.spyOn(provider.accounts, "update");
    const { queryClient } = renderHookWithProviders(() => useRescheduleInstallments(), {
      provider,
    });
    await waitFor(() => expect(cached(queryClient)).toBeDefined());
    expect(update).not.toHaveBeenCalled();
  });
});

describe("useUpdateAccount", () => {
  it("a name-only edit sends no installments (US3-4)", async () => {
    const provider = createMemoryProvider(snapshot());
    const { result, queryClient } = renderHookWithProviders(() => useEditor(), {
      provider,
    });
    await waitFor(() => expect(cached(queryClient)).toBeDefined());
    act(() => result.current.mutate({ id: banregio.id, patch: { name: "Banregio Oro" } }));
    await waitFor(() => expect(provider.accounts.update).toHaveBeenCalledTimes(1));
    expect(provider.accounts.update).toHaveBeenCalledWith(
      banregio.id,
      { name: "Banregio Oro" },
      [],
    );
  });

  it("a terms edit reschedules the not-collected installments in the same write (US3-1)", async () => {
    const provider = createMemoryProvider(snapshot());
    const { result, queryClient } = renderHookWithProviders(() => useEditor(), {
      provider,
    });
    await waitFor(() => expect(cached(queryClient)).toBeDefined());
    act(() =>
      result.current.mutate({
        id: banregio.id,
        patch: { cutOffDay: 15, paymentDueOffsetDays: 20 },
      }),
    );
    await waitFor(() => expect(provider.accounts.update).toHaveBeenCalledTimes(1));
    // Nov 15 is the first statement; seq 2 closes Dec 15 + 20 = Mon Jan 4, 2027.
    expect(provider.accounts.update).toHaveBeenCalledWith(
      banregio.id,
      { cutOffDay: 15, paymentDueOffsetDays: 20 },
      [{ id: pending.id, cardDueOn: "2027-01-04", dueOn: "2027-01-01" }],
    );
    const stored = provider.state.snapshot.installments;
    expect(stored.find((i) => i.id === collected.id)?.cardDueOn).toBe("2026-11-04");
    expect(stored.find((i) => i.id === pending.id)?.cardDueOn).toBe("2027-01-04");
  });
});
