/**
 * Writable in-memory DataProvider for hook tests: the MockProvider's reads over a MUTABLE
 * snapshot, `canWrite: true`, and the write methods background processes use — including the
 * (recurring_expense_id, occurrence_date) unique index of `expenses` and the foreign key to
 * `recurring_expenses`, like Postgres. `recurring.create` assigns a NEW server id (different from
 * any optimistic one) and can be held open with `holdRecurringCreate()`.
 *
 * Spec 005: `expenses.create`/`remove` and every `expenseTemplates` write also work over the
 * snapshot (create → new server id, remove of a template = archived). `holdExpenseCreate()` keeps
 * expense creations pending, to test Undo while the server hasn't answered.
 *
 * Spec 007: `accounts.update` patches the account and, with `reschedule`, the installments in the
 * same step, with the RPC's checks (that card's, not collected; all or nothing → VALIDATION).
 */
import { vi, type Mock } from "vitest";
import { createMockProvider } from "@/data/mock/provider";
import {
  ProviderError,
  type AccountsRepository,
  type DataProvider,
  type ExpenseTemplatesRepository,
  type ExpensesRepository,
  type GoalsRepository,
  type NewEntity,
  type RecurringRepository,
} from "@/data/provider";
import type {
  Expense,
  ExpenseTemplate,
  FinanceSnapshot,
  RecurringExpense,
  Uuid,
} from "@/domain/types";

type MaterializeFn = ExpensesRepository["materializeRecurring"];
type CreateRecurringFn = RecurringRepository["create"];
type CreateExpenseFn = ExpensesRepository["create"];
type RemoveExpenseFn = ExpensesRepository["remove"];
type Templates = ExpenseTemplatesRepository;
type UpdateAccountFn = AccountsRepository["update"];

export interface MemoryProvider extends DataProvider {
  readonly state: { snapshot: FinanceSnapshot };
  readonly expenses: ExpensesRepository & {
    materializeRecurring: Mock<MaterializeFn>;
    create: Mock<CreateExpenseFn>;
    remove: Mock<RemoveExpenseFn>;
  };
  readonly recurring: RecurringRepository & { create: Mock<CreateRecurringFn> };
  readonly accounts: AccountsRepository & { update: Mock<UpdateAccountFn> };
  readonly goals: GoalsRepository & { addSavedMove: Mock<GoalsRepository["addSavedMove"]> };
  readonly expenseTemplates: {
    list: Templates["list"];
    create: Mock<Templates["create"]>;
    update: Mock<Templates["update"]>;
    remove: Mock<Templates["remove"]>;
    reorder: Mock<Templates["reorder"]>;
  };
  /** Keeps every recurring.create pending until the returned function is called. */
  holdRecurringCreate(): () => void;
  /** Keeps every expenses.create pending until the returned function is called. */
  holdExpenseCreate(): () => void;
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

  let expenseHold: Promise<void> | null = null;
  const createExpense = vi.fn<CreateExpenseFn>(async (input) => {
    if (expenseHold) await expenseHold;
    const row: Expense = { ...input, id: newId() };
    state.snapshot = { ...state.snapshot, expenses: [...state.snapshot.expenses, row] };
    return row;
  });
  const removeExpense = vi.fn<RemoveExpenseFn>(async (id) => {
    state.snapshot = {
      ...state.snapshot,
      expenses: state.snapshot.expenses.filter((e) => e.id !== id),
    };
  });

  const findTemplate = (id: Uuid) => {
    const row = state.snapshot.expenseTemplates.find((t) => t.id === id);
    if (!row) throw new ProviderError("NOT_FOUND", `template ${id} does not exist`);
    return row;
  };
  const setTemplates = (rows: ExpenseTemplate[]) => {
    state.snapshot = { ...state.snapshot, expenseTemplates: rows };
  };
  const expenseTemplates: MemoryProvider["expenseTemplates"] = {
    list: async () => [...state.snapshot.expenseTemplates],
    create: vi.fn<Templates["create"]>(async (input) => {
      const row: ExpenseTemplate = { ...input, id: newId() };
      setTemplates([...state.snapshot.expenseTemplates, row]);
      return row;
    }),
    update: vi.fn<Templates["update"]>(async (id, patch) => {
      const row = { ...findTemplate(id), ...patch };
      setTemplates(state.snapshot.expenseTemplates.map((t) => (t.id === id ? row : t)));
      return row;
    }),
    remove: vi.fn<Templates["remove"]>(async (id) => {
      findTemplate(id);
      setTemplates(
        state.snapshot.expenseTemplates.map((t) => (t.id === id ? { ...t, archived: true } : t)),
      );
    }),
    reorder: vi.fn<Templates["reorder"]>(async (ids) => {
      ids.forEach(findTemplate);
      setTemplates(
        state.snapshot.expenseTemplates.map((t) =>
          ids.includes(t.id) ? { ...t, sort: ids.indexOf(t.id) } : t,
        ),
      );
    }),
  };

  const updateAccount = vi.fn<UpdateAccountFn>(async (id, patch, reschedule = []) => {
    const s = state.snapshot;
    const account = s.accounts.find((a) => a.id === id);
    if (!account) throw new ProviderError("NOT_FOUND", `account ${id} does not exist`);
    const ofCard = new Set(s.receivables.filter((r) => r.cardAccountId === id).map((r) => r.id));
    const dates = new Map(reschedule.map((r) => [r.id, r]));
    const allowed = s.installments.filter(
      (i) => dates.has(i.id) && ofCard.has(i.receivableId) && i.status !== "collected",
    );
    if (allowed.length !== reschedule.length) {
      throw new ProviderError("VALIDATION", "installments of another card or already collected");
    }
    const row = { ...account, ...patch };
    state.snapshot = {
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? row : a)),
      installments: s.installments.map((i) => {
        const next = dates.get(i.id);
        return next ? { ...i, dueOn: next.dueOn, cardDueOn: next.cardDueOn } : i;
      }),
    };
    return row;
  });

  // Spec 014: assign / return Saved over the snapshot.
  const addSavedMove = vi.fn<GoalsRepository["addSavedMove"]>(async (input) => {
    const row = { ...input, id: newId() };
    state.snapshot = { ...state.snapshot, savedMoves: [...state.snapshot.savedMoves, row] };
    return row;
  });

  const holdOpen = (set: (p: Promise<void> | null) => void) => {
    let release!: () => void;
    set(new Promise<void>((r) => (release = r)));
    return () => {
      set(null);
      release();
    };
  };

  return {
    ...base,
    mode: "live",
    capabilities: { canWrite: true },
    state,
    expenses: {
      ...base.expenses,
      materializeRecurring,
      create: createExpense,
      remove: removeExpense,
    },
    recurring: { ...base.recurring, create },
    accounts: { ...base.accounts, update: updateAccount },
    goals: { ...base.goals, addSavedMove },
    expenseTemplates,
    loadSnapshot: vi.fn(async () => state.snapshot),
    holdRecurringCreate: () => holdOpen((p) => (hold = p)),
    holdExpenseCreate: () => holdOpen((p) => (expenseHold = p)),
  };
}

/** Makes the next call of `fn` reject like a dropped connection. */
export function failOnce(fn: Mock<MaterializeFn>) {
  fn.mockImplementationOnce(async () => {
    throw new ProviderError("OFFLINE", "network down");
  });
}
