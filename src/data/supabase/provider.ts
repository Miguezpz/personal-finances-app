/**
 * SupabaseProvider (T037): production implementation of DataProvider.
 * Repositories only move data; every business calculation happens in src/domain.
 */
import type { FinanceSnapshot } from "@/domain/types";
import type { DataProvider } from "../provider";
import { createSupabaseAuth } from "./auth";
import { getSupabaseBrowserClient, type AppSupabaseClient } from "./client";
import { createAccountsRepository } from "./repos/accounts";
import { createStatementMarksRepository } from "./repos/statement-marks";
import { createExpenseTemplatesRepository } from "./repos/expense-templates";
import { createExpensesRepository, createRecurringRepository } from "./repos/expenses";
import {
  createGoalsRepository,
  createLedgerRepository,
  createNetWorthRepository,
} from "./repos/goals";
import { createIncomesRepository } from "./repos/incomes";
import { createReceivablesRepository } from "./repos/receivables";
import { createRulesRepository } from "./repos/rules";
import { createSettingsRepository } from "./repos/settings";
import { createTaxonomyRepository } from "./repos/taxonomy";

export interface SupabaseProviderOptions {
  /** Injected in tests; defaults to the browser client configured from the environment. */
  client?: AppSupabaseClient;
}

export function createSupabaseProvider(options: SupabaseProviderOptions = {}): DataProvider {
  const db = options.client ?? getSupabaseBrowserClient();

  const settings = createSettingsRepository(db);
  const accounts = createAccountsRepository(db);
  const rules = createRulesRepository(db);
  const taxonomy = createTaxonomyRepository(db);
  const incomes = createIncomesRepository(db);
  const expenses = createExpensesRepository(db);
  const recurring = createRecurringRepository(db);
  const expenseTemplates = createExpenseTemplatesRepository(db);
  const statementMarks = createStatementMarksRepository(db);
  const receivables = createReceivablesRepository(db);
  const goals = createGoalsRepository(db);
  const netWorth = createNetWorthRepository(db);
  const ledger = createLedgerRepository(db);

  return {
    mode: "live",
    capabilities: { canWrite: true },
    auth: createSupabaseAuth(db),
    settings,
    accounts,
    rules,
    taxonomy,
    incomes,
    expenses,
    recurring,
    expenseTemplates,
    statementMarks,
    receivables,
    goals,
    netWorth,
    ledger,

    /** The whole history in one parallel batch (each table paged past PostgREST's max_rows). */
    async loadSnapshot(): Promise<FinanceSnapshot> {
      const [
        userSettings,
        accountList,
        ruleList,
        categories,
        subcategories,
        incomeData,
        recurringList,
        expenseList,
        markList,
        debtors,
        receivableData,
        goalData,
        netWorthSnapshots,
        templateList,
      ] = await Promise.all([
        settings.get(),
        accounts.list({ includeArchived: true }),
        rules.list(),
        taxonomy.listCategories(),
        taxonomy.listSubcategories(),
        incomes.list(),
        recurring.list(),
        expenses.list(),
        statementMarks.list(),
        receivables.listDebtors(),
        receivables.list(),
        goals.list(),
        netWorth.list(),
        expenseTemplates.list(),
      ]);
      return {
        settings: userSettings,
        accounts: accountList,
        rules: ruleList,
        categories,
        subcategories,
        incomes: incomeData.incomes,
        allocations: incomeData.allocations,
        recurring: recurringList,
        expenses: expenseList,
        statementMarks: markList,
        debtors,
        receivables: receivableData.receivables,
        installments: receivableData.installments,
        goals: goalData.goals,
        contributions: goalData.contributions,
        savedMoves: goalData.savedMoves,
        netWorthSnapshots,
        expenseTemplates: templateList,
      };
    },
  };
}
