"use client";

/**
 * THE domain query (T158, research.md R17). All domain data lives under queryKeys.snapshot;
 * aggregate hooks are `select`ors over it, so Safe-to-Spend, ledger, net worth and export
 * always read the same coherent picture. Enabled only while there is a session.
 *
 * Spec 009 (US2): rows whose deletion is pending (Undo window) are hidden here, for every reader.
 * With nothing pending the caller's selector is passed through untouched, so TanStack Query keeps
 * memoizing it.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FinanceSnapshot } from "@/domain/types";
import { hidePending, usePendingDeletes } from "@/store/pending-deletes";
import { useDataProvider } from "./context";
import { queryKeys } from "./query-keys";
import { useSession } from "./session";

const identity = (s: FinanceSnapshot) => s;

export function useFinanceSnapshot(): UseQueryResult<FinanceSnapshot>;
export function useFinanceSnapshot<T>(select: (snapshot: FinanceSnapshot) => T): UseQueryResult<T>;
export function useFinanceSnapshot<T>(select?: (snapshot: FinanceSnapshot) => T) {
  const provider = useDataProvider();
  // Never fetch domain data without a session (no 401s on sign-out or with an expired session).
  const { data: session } = useSession();
  const pending = usePendingDeletes((s) => s.entries);
  const base = (select ?? identity) as (snapshot: FinanceSnapshot) => T;
  const withPending = useCallback(
    (snapshot: FinanceSnapshot) => base(hidePending(snapshot, pending)),
    [base, pending],
  );
  const effective = pending.length > 0 ? withPending : select;
  return useQuery({
    queryKey: queryKeys.snapshot,
    queryFn: () => provider.loadSnapshot(),
    enabled: Boolean(session),
    ...(effective ? { select: effective } : {}),
  });
}

/** Loading / error state of the snapshot, for pages' PageQueryState (spec 009, FR-014). */
export function useSnapshotStatus(): { isPending: boolean; isError: boolean; refetch: () => void } {
  const { isPending, isError, refetch } = useFinanceSnapshot(selectNothing);
  return { isPending, isError, refetch: () => void refetch() };
}
const selectNothing = () => null;

// Stable selectors (module-level, so TanStack Query memoizes their results).
export const selectSettings = (s: FinanceSnapshot) => s.settings;
export const selectAccounts = (s: FinanceSnapshot) => s.accounts;
export const selectRules = (s: FinanceSnapshot) => s.rules;
export const selectRecurring = (s: FinanceSnapshot) => s.recurring;
export const selectExpenses = (s: FinanceSnapshot) => s.expenses;
export const selectCardPayments = (s: FinanceSnapshot) => s.cardPayments;
