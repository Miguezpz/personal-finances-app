/**
 * Spec 005 (T014, T025) · Quick expense hooks over the writable memory provider:
 *  - a tap adds the optimistic expense before the server answers, and a failure restores the exact
 *    previous snapshot (FR-008);
 *  - Undo while the create is still pending waits for the real id and deletes that one (R5);
 *  - two taps → the second Undo leaves the first expense (FR-009, FR-010);
 *  - overrides reach the expense and the template never changes (FR-007a);
 *  - template management is optimistic, with an exact rollback on failure.
 */
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { cents } from "@/domain/money";
import { activeTemplates, nextSort } from "@/domain/quick-expenses";
import type { FinanceSnapshot } from "@/domain/types";
import {
  UNDO_TOAST_MS,
  useCreateTemplate,
  useQuickExpense,
  useRemoveTemplate,
  useReorderTemplates,
  useUpdateTemplate,
} from "@/features/expenses/quick-expense-hooks";
import {
  d,
  emptySnapshot,
  makeCategory,
  makeExpense,
  makeSubcategory,
  makeTemplate,
} from "../../utils/fixtures";
import { createMemoryProvider, type MemoryProvider } from "../../utils/memory-provider";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

type ToastOptions = { duration?: number; action?: { label: string; onClick: () => void } };
const toastMock = vi.hoisted(() => {
  const fn = Object.assign(vi.fn(), {
    success: vi.fn<(message: string, options?: ToastOptions) => string>(() => "toast-id"),
    error: vi.fn(),
    dismiss: vi.fn(),
  });
  return fn;
});
vi.mock("sonner", () => ({ toast: toastMock }));

const transport = makeCategory({ name: "Transport", macro: "needs" });
const bus = makeSubcategory({ categoryId: transport.id, name: "Public transport" });
const template = makeTemplate({ name: "Transporte", amount: cents(2400), subcategoryId: bus.id });
const existing = makeExpense({ subcategoryId: bus.id, amount: cents(10_000), bucket: "needs" });

const snapshot = (o: Partial<FinanceSnapshot> = {}): FinanceSnapshot =>
  emptySnapshot({
    categories: [transport],
    subcategories: [bus],
    expenses: [existing],
    expenseTemplates: [template],
    ...o,
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T18:00:00Z")); // Nov 5 in Mexico City
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.dismiss.mockClear();
});
afterEach(() => vi.useRealTimers());

function setup(initial = snapshot()) {
  const provider: MemoryProvider = createMemoryProvider(initial);
  const view = renderHookWithProviders(
    () => ({
      quick: useQuickExpense(),
      create: useCreateTemplate(),
      update: useUpdateTemplate(),
      remove: useRemoveTemplate(),
      reorder: useReorderTemplates(),
    }),
    { provider },
  );
  view.queryClient.setQueryData(queryKeys.snapshot, initial);
  const cached = () => view.queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot);
  return { ...view, provider, cached };
}

const undoOf = (call = 0) => {
  const options = toastMock.success.mock.calls[call]?.[1];
  if (!options?.action) throw new Error("no Undo action on the toast");
  return options.action.onClick;
};

describe("useQuickExpense().apply", () => {
  it("adds the optimistic expense before the create resolves, with an Undo toast", async () => {
    const { result, provider, cached } = setup();
    const release = provider.holdExpenseCreate();

    act(() => result.current.quick.apply(template));

    await waitFor(() => expect(cached()?.expenses).toHaveLength(2));
    const added = cached()?.expenses.find((e) => e.id !== existing.id);
    expect(added).toMatchObject({
      amount: 2400,
      spentOn: "2026-11-05",
      note: "Transporte",
      bucket: "needs",
      origin: "manual",
    });
    expect(provider.expenses.create).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      "Transporte recorded.",
      expect.objectContaining({ duration: UNDO_TOAST_MS }),
    );
    expect(UNDO_TOAST_MS).toBeGreaterThanOrEqual(5000);
    release();
  });

  it("restores exactly the previous snapshot when the create fails", async () => {
    const initial = snapshot();
    const { result, provider, cached } = setup(initial);
    provider.expenses.create.mockImplementationOnce(async () => {
      throw new ProviderError("UNKNOWN", "boom");
    });

    act(() => result.current.quick.apply(template));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.any(String)));
    expect(cached()?.expenses).toEqual(initial.expenses);
    expect(toastMock.dismiss).toHaveBeenCalledWith("toast-id");
  });

  it("Undo while the create is pending waits for the real id and deletes that row", async () => {
    const { result, provider, cached } = setup();
    const release = provider.holdExpenseCreate();

    act(() => result.current.quick.apply(template));
    await waitFor(() => expect(cached()?.expenses).toHaveLength(2));
    const tempId = cached()?.expenses.find((e) => e.id !== existing.id)?.id;

    act(() => undoOf(0)());
    expect(provider.expenses.remove).not.toHaveBeenCalled();

    await act(async () => release());

    await waitFor(() => expect(provider.expenses.remove).toHaveBeenCalledTimes(1));
    const removedId = provider.expenses.remove.mock.calls[0]?.[0];
    expect(removedId).not.toBe(tempId);
    expect((await provider.expenses.create.mock.results[0]?.value)?.id).toBe(removedId);
    await waitFor(() => expect(cached()?.expenses).toEqual([existing]));
    expect(provider.state.snapshot.expenses).toEqual([existing]);
    expect(toastMock).toHaveBeenCalledWith("Expense removed.");
  });

  it("two taps record two expenses; the second Undo leaves the first", async () => {
    const { result, provider, cached } = setup();

    act(() => result.current.quick.apply(template));
    act(() => result.current.quick.apply(template));
    await waitFor(() => expect(provider.state.snapshot.expenses).toHaveLength(3));
    const [first, second] = await Promise.all(
      provider.expenses.create.mock.results.map((r) => r.value),
    );

    act(() => undoOf(1)());

    await waitFor(() => expect(provider.expenses.remove).toHaveBeenCalledWith(second?.id));
    await waitFor(() =>
      expect(cached()?.expenses.map((e) => e.id)).toEqual([existing.id, first?.id]),
    );
  });

  it("overrides reach the expense and the template keeps its amount", async () => {
    const { result, provider, cached } = setup();

    act(() =>
      result.current.quick.apply(template, { amount: cents(1200), spentOn: d("2026-11-04") }),
    );

    await waitFor(() => expect(provider.expenses.create).toHaveBeenCalledTimes(1));
    expect(provider.expenses.create.mock.calls[0]?.[0]).toMatchObject({
      amount: 1200,
      spentOn: "2026-11-04",
      note: "Transporte",
    });
    expect(cached()?.expenseTemplates).toEqual([template]);
  });

  it("does nothing for a template whose subcategory is archived", async () => {
    const { result, provider } = setup(snapshot({ subcategories: [{ ...bus, archived: true }] }));
    act(() => result.current.quick.apply(template));
    expect(provider.expenses.create).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

describe("template management hooks", () => {
  it("useCreateTemplate adds it optimistically with sort = nextSort", async () => {
    const initial = snapshot();
    const { result, provider, cached } = setup(initial);
    const sort = nextSort(initial.expenseTemplates);

    act(() =>
      result.current.create.mutate({
        name: "Café",
        amount: cents(5500),
        subcategoryId: bus.id,
        paymentAccountId: null,
        sort,
        archived: false,
      }),
    );

    await waitFor(() =>
      expect(activeTemplates(cached()?.expenseTemplates ?? []).map((t) => t.name)).toEqual([
        "Transporte",
        "Café",
      ]),
    );
    expect(sort).toBe(1);
    await waitFor(() => expect(provider.state.snapshot.expenseTemplates).toHaveLength(2));
  });

  it("useRemoveTemplate hides it from the active list without touching expenses", async () => {
    const initial = snapshot();
    const { result, cached } = setup(initial);

    act(() => result.current.remove.mutate(template.id));

    await waitFor(() => expect(activeTemplates(cached()?.expenseTemplates ?? [])).toEqual([]));
    expect(cached()?.expenses).toEqual(initial.expenses);
    expect(cached()?.expenseTemplates).toEqual([{ ...template, archived: true }]);
  });

  it("useReorderTemplates swaps the sort values", async () => {
    const other = makeTemplate({ name: "Café", subcategoryId: bus.id, sort: 1 });
    const { result, cached } = setup(snapshot({ expenseTemplates: [template, other] }));

    act(() => result.current.reorder.mutate([other.id, template.id]));

    await waitFor(() =>
      expect(activeTemplates(cached()?.expenseTemplates ?? []).map((t) => t.id)).toEqual([
        other.id,
        template.id,
      ]),
    );
  });

  it("rolls back exactly when an update fails", async () => {
    const initial = snapshot();
    const { result, provider, cached } = setup(initial);
    provider.expenseTemplates.update.mockImplementationOnce(async () => {
      throw new ProviderError("UNKNOWN", "boom");
    });

    act(() => result.current.update.mutate({ id: template.id, patch: { amount: cents(3000) } }));

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(cached()?.expenseTemplates).toEqual(initial.expenseTemplates);
  });
});
