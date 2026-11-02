/**
 * Writable in-memory DataProvider for hook tests: the MockProvider's reads over a MUTABLE
 * snapshot, `canWrite: true`, and the write methods background processes use — including the
 * (recurring_expense_id, occurrence_date) unique index of `expenses`, like Postgres.
 */
import { vi, type Mock } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import {
  ProviderError,
  type DataProvider,
  type ExpensesRepository,
  type NewEntity,
} from "@/data/provider";
import type { Expense, FinanceSnapshot, Uuid } from "@/domain/types";

type MaterializeFn = ExpensesRepository["materializeRecurring"];

export interface MemoryProvider extends DataProvider {
  readonly state: { snapshot: FinanceSnapshot };
  readonly expenses: ExpensesRepository & { materializeRecurring: Mock<MaterializeFn> };
}

let seq = 0;
const newId = () => `00000000-0000-4000-a000-${(++seq).toString(16).padStart(12, "0")}` as Uuid;

export function createMemoryProvider(initial: FinanceSnapshot): MemoryProvider {
  const state = { snapshot: structuredClone(initial) as FinanceSnapshot };
  const base = createMockProvider({ snapshot: initial });

  const materializeRecurring = vi.fn<MaterializeFn>(
    async (items: ReadonlyArray<NewEntity<Expense>>) => {
      const key = (e: Pick<Expense, "recurringExpenseId" | "occurrenceDate">) =>
        `${e.recurringExpenseId}|${e.occurrenceDate}`;
      const existing = new Set(state.snapshot.expenses.map(key));
      const inserted: Expense[] = [];
      for (const item of items) {
        if (existing.has(key(item))) continue; // ON CONFLICT DO NOTHING
        const row = { ...item, id: newId() };
        existing.add(key(row));
        inserted.push(row);
      }
      state.snapshot = { ...state.snapshot, expenses: [...state.snapshot.expenses, ...inserted] };
      return inserted;
    },
  );

  return {
    ...base,
    mode: "live",
    capabilities: { canWrite: true },
    state,
    expenses: { ...base.expenses, materializeRecurring },
    loadSnapshot: vi.fn(async () => state.snapshot),
  };
}

/** Makes the next call of `fn` reject like a dropped connection. */
export function failOnce(fn: Mock<MaterializeFn>) {
  fn.mockImplementationOnce(async () => {
    throw new ProviderError("OFFLINE", "network down");
  });
}
