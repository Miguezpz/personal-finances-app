/**
 * MockProvider (T041): the public demo's DataProvider. Real reads over an in-memory, deep-frozen
 * snapshot; every write rejects with DemoReadOnlyError (FR-047). It never imports Supabase, so
 * the demo bundle has no Supabase code at all (Principle IV).
 */
import { todayIn } from "@/domain/periods";
import { DEFAULT_TIMEZONE } from "@/domain/settings";
import { buildLedger } from "@/domain/ledger";
import type { FinanceSnapshot, IsoDate, Uuid } from "@/domain/types";
import type { AuthSession, DataProvider } from "../provider";
import { denyWrite } from "./read-only";
import { generateDemoSnapshot } from "./seed";
import { createMockStore, type MockStore } from "./store";

export interface MockProviderOptions {
  /** Inject a snapshot (tests) instead of generating the demo data. */
  snapshot?: FinanceSnapshot;
  /** "Today" for the generated demo data; defaults to the current date in Mexico City. */
  today?: IsoDate;
}

/** Synthetic read-only session: the demo visitor never authenticates. */
const DEMO_SESSION: AuthSession = {
  userId: "00000000-0000-4000-8000-000000000d30" as Uuid,
  email: null,
};

type Range = { from: IsoDate; to: IsoDate } | undefined;
const inRange = (d: IsoDate, range: Range) => !range || (d >= range.from && d <= range.to);

export function createMockProvider(options: MockProviderOptions = {}): DataProvider {
  const store: MockStore = createMockStore(
    options.snapshot ??
      generateDemoSnapshot({ today: options.today ?? todayIn(DEFAULT_TIMEZONE, new Date()) }),
  );
  const s = () => store.snapshot;
  // Callers get fresh arrays (the stored ones are frozen).
  const list = <T>(items: readonly T[]) => Promise.resolve([...items]);

  return {
    mode: "demo",
    capabilities: { canWrite: false },

    auth: {
      getSession: () => Promise.resolve(DEMO_SESSION),
      signIn: () => denyWrite("auth.signIn"),
      signInWithGoogle: () => denyWrite("auth.signInWithGoogle"),
      signOut: () => Promise.resolve(),
      onChange: () => () => {},
    },

    settings: {
      get: () => Promise.resolve({ ...s().settings }),
      update: () => denyWrite("settings.update"),
    },

    accounts: {
      list: (opts) => list(s().accounts.filter((a) => opts?.includeArchived || !a.archived)),
      create: () => denyWrite("accounts.create"),
      update: () => denyWrite("accounts.update"),
      archive: () => denyWrite("accounts.archive"),
    },

    rules: {
      list: () => list(s().rules),
      save: () => denyWrite("rules.save"),
    },

    taxonomy: {
      listCategories: () => list(s().categories),
      listSubcategories: () => list(s().subcategories),
      createCategory: () => denyWrite("taxonomy.createCategory"),
      createSubcategory: () => denyWrite("taxonomy.createSubcategory"),
      update: () => denyWrite("taxonomy.update"),
      remove: () => denyWrite("taxonomy.remove"),
    },

    incomes: {
      async list(range) {
        const incomes = s().incomes.filter((i) => inRange(i.receivedOn, range));
        const ids = new Set(incomes.map((i) => i.id));
        return {
          incomes,
          allocations: s().allocations.filter((a) => !range || ids.has(a.incomeId)),
        };
      },
      register: () => denyWrite("incomes.register"),
      replace: () => denyWrite("incomes.replace"),
      remove: () => denyWrite("incomes.remove"),
    },

    expenses: {
      list: (range) => list(s().expenses.filter((e) => inRange(e.spentOn, range))),
      create: () => denyWrite("expenses.create"),
      update: () => denyWrite("expenses.update"),
      remove: () => denyWrite("expenses.remove"),
      materializeRecurring: () => denyWrite("expenses.materializeRecurring"),
    },

    recurring: {
      list: () => list(s().recurring),
      create: () => denyWrite("recurring.create"),
      update: () => denyWrite("recurring.update"),
      end: () => denyWrite("recurring.end"),
      remove: () => denyWrite("recurring.remove"),
    },

    cardPayments: {
      list: (range) => list(s().cardPayments.filter((p) => inRange(p.paidOn, range))),
      create: () => denyWrite("cardPayments.create"),
      remove: () => denyWrite("cardPayments.remove"),
    },

    receivables: {
      listDebtors: () => list(s().debtors),
      createDebtor: () => denyWrite("receivables.createDebtor"),
      list: async () => ({
        receivables: [...s().receivables],
        installments: [...s().installments],
      }),
      create: () => denyWrite("receivables.create"),
      recordCollection: () => denyWrite("receivables.recordCollection"),
      remove: () => denyWrite("receivables.remove"),
    },

    goals: {
      list: async () => ({ goals: [...s().goals], contributions: [...s().contributions] }),
      create: () => denyWrite("goals.create"),
      update: () => denyWrite("goals.update"),
      addContributions: () => denyWrite("goals.addContributions"),
    },

    netWorth: {
      list: () => list(s().netWorthSnapshots),
      upsertMonthly: () => denyWrite("netWorth.upsertMonthly"),
    },

    ledger: {
      list: (range) => list(buildLedger(s()).filter((e) => inRange(e.occurredOn, range))),
    },

    loadSnapshot: () => Promise.resolve(s()),
  };
}
