"use client";

/**
 * THE domain query (T158, research.md R17). All domain data lives under queryKeys.snapshot;
 * aggregate hooks are `select`ors over it, so Safe-to-Spend, ledger, net worth and export
 * always read the same coherent picture. Enabled only while there is a session.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { FinanceSnapshot } from "@/domain/types";
import { useDataProvider } from "./context";
import { queryKeys } from "./query-keys";
import { useSession } from "./session";

export function useFinanceSnapshot(): UseQueryResult<FinanceSnapshot>;
export function useFinanceSnapshot<T>(select: (snapshot: FinanceSnapshot) => T): UseQueryResult<T>;
export function useFinanceSnapshot<T>(select?: (snapshot: FinanceSnapshot) => T) {
  const provider = useDataProvider();
  // Never fetch domain data without a session (no 401s on sign-out or with an expired session).
  const { data: session } = useSession();
  return useQuery({
    queryKey: queryKeys.snapshot,
    queryFn: () => provider.loadSnapshot(),
    enabled: Boolean(session),
    ...(select ? { select } : {}),
  });
}

// Stable selectors (module-level, so TanStack Query memoizes their results).
export const selectSettings = (s: FinanceSnapshot) => s.settings;
export const selectAccounts = (s: FinanceSnapshot) => s.accounts;
export const selectRules = (s: FinanceSnapshot) => s.rules;
export const selectCategories = (s: FinanceSnapshot) => s.categories;
export const selectSubcategories = (s: FinanceSnapshot) => s.subcategories;
export const selectIncomes = (s: FinanceSnapshot) => s.incomes;
export const selectAllocations = (s: FinanceSnapshot) => s.allocations;
export const selectRecurring = (s: FinanceSnapshot) => s.recurring;
export const selectExpenses = (s: FinanceSnapshot) => s.expenses;
export const selectCardPayments = (s: FinanceSnapshot) => s.cardPayments;
export const selectDebtors = (s: FinanceSnapshot) => s.debtors;
export const selectReceivables = (s: FinanceSnapshot) => s.receivables;
export const selectInstallments = (s: FinanceSnapshot) => s.installments;
export const selectGoals = (s: FinanceSnapshot) => s.goals;
export const selectContributions = (s: FinanceSnapshot) => s.contributions;
export const selectNetWorthSnapshots = (s: FinanceSnapshot) => s.netWorthSnapshots;
