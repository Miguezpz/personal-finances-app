/**
 * Writable in-memory DataProvider for hook tests: the MockProvider's reads over a MUTABLE
 * snapshot, `canWrite: true`, and the write methods background processes use — including the
 * (recurring_expense_id, occurrence_date) unique index of `expenses` and the foreign key to
 * `recurring_expenses`, like Postgres. `recurring.create` assigns a NEW server id (different from
 * any optimistic one) and can be held open with `holdRecurringCreate()`.
 */
import { vi, type Mock } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import {
  ProviderError,
  type DataProvider,
  type ExpensesRepository,
  type NewEntity,
  type RecurringRepository,
} from "@/data/provider";
import type { Expense, FinanceSnapshot, RecurringExpense, Uuid } from "@/domain/types";

type MaterializeFn = ExpensesRepository["materializeRecurring"];
type CreateRecurringFn = RecurringRepository["create"];

export interface MemoryProvider extends DataProvider {
  readonly state: { snapshot: FinanceSnapshot };
  readonly expenses: ExpensesRepository & { materializeRecurring: Mock<MaterializeFn> };
  readonly recurring: RecurringRepository & { create: Mock<CreateRecurringFn> };
  /** Keeps every recurring.create pending until the returned function is called. */
  holdRecurringCreate(): () => void;
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
      const recurringIds = new Set(state.snapshot.recurring.map((r) => r.id));
      for (const item of items) {
        if (item.recurringExpenseId && !recurringIds.has(item.recurringExpenseId)) {
          // FOREIGN KEY violation (e.g. an optimistic id that was never saved) → 23503 → CONFLICT
          throw new ProviderError(
            "CONFLICT",
            `recurring expense ${item.recurringExpenseId} does not exist`,
          );
        }
        if (existing.has(key(item))) continue; // ON CONFLICT DO NOTHING
        const row = { ...item, id: newId() };
        existing.add(key(row));
        inserted.push(row);
      }
      state.snapshot = { ...state.snapshot, expenses: [...state.snapshot.expenses, ...inserted] };
      return inserted;
    },
  );

  let hold: Promise<void> | null = null;
  const create = vi.fn<CreateRecurringFn>(async (input) => {
    if (hold) await hold;
    const row: RecurringExpense = { ...input, id: newId() };
    state.snapshot = { ...state.snapshot, recurring: [...state.snapshot.recurring, row] };
    return row;
  });

  return {
    ...base,
    mode: "live",
    capabilities: { canWrite: true },
    state,
    expenses: { ...base.expenses, materializeRecurring },
    recurring: { ...base.recurring, create },
    loadSnapshot: vi.fn(async () => state.snapshot),
    holdRecurringCreate() {
      let release!: () => void;
      hold = new Promise<void>((r) => (release = r));
      return () => {
        hold = null;
        release();
      };
    },
  };
}

/** Makes the next call of `fn` reject like a dropped connection. */
export function failOnce(fn: Mock<MaterializeFn>) {
  fn.mockImplementationOnce(async () => {
    throw new ProviderError("OFFLINE", "network down");
  });
}
