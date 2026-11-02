"use client";

/**
 * Safe-to-Spend of the current quincena (T073): a derived selector over the single snapshot, so
 * any optimistic change to an expense, income or recurring charge re-renders it at once (SC-004).
 */
import { useMemo } from "react";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { periodOf } from "@/domain/periods";
import { recurringStatusForPeriod, type RecurringStatusItem } from "@/domain/recurring";
import { computeSafeToSpend, type SafeToSpend } from "@/domain/safe-to-spend";
import { useToday } from "@/lib/use-today";

export function useSafeToSpend(): {
  data: SafeToSpend | undefined;
  /** Recurring charges of the current quincena, applied or pending (FR-008a). */
  recurringItems: readonly RecurringStatusItem[];
  /** True when no income has ever been split (empty state). */
  hasAllocations: boolean;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const today = useToday();
  const snapshot = useFinanceSnapshot();
  const recurringItems = useMemo(() => {
    const s = snapshot.data;
    return s ? recurringStatusForPeriod(s.recurring, s.expenses, periodOf(today)) : [];
  }, [snapshot.data, today]);
  const data = useMemo(() => {
    const s = snapshot.data;
    if (!s) return undefined;
    return computeSafeToSpend({
      period: periodOf(today),
      today,
      settings: s.settings,
      allocations: s.allocations,
      expenses: s.expenses,
      recurring: s.recurring,
      goals: s.goals,
      contributions: s.contributions,
    });
  }, [snapshot.data, today]);

  return {
    data,
    recurringItems,
    hasAllocations: (snapshot.data?.allocations.length ?? 0) > 0,
    isPending: snapshot.isPending,
    isError: snapshot.isError,
    refetch: () => void snapshot.refetch(),
  };
}
