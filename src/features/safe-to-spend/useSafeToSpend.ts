"use client";

/**
 * Safe-to-Spend of the current quincena (T073): a derived selector over the single snapshot, so
 * any optimistic change to an expense, income or recurring charge re-renders it at once (SC-004).
 * The current quincena is the one whose effective range holds today (spec 006).
 */
import { useMemo } from "react";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { buildPayCalendar, periodOfDate } from "@/domain/pay-calendar";
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
  const current = useMemo(() => {
    const s = snapshot.data;
    if (!s) return undefined;
    const calendar = buildPayCalendar(s.settings, s.incomes);
    return { calendar, period: periodOfDate(today, calendar) };
  }, [snapshot.data, today]);
  const recurringItems = useMemo(() => {
    const s = snapshot.data;
    return s && current ? recurringStatusForPeriod(s.recurring, s.expenses, current.period) : [];
  }, [snapshot.data, current]);
  const data = useMemo(() => {
    const s = snapshot.data;
    if (!s || !current) return undefined;
    return computeSafeToSpend({
      period: current.period,
      calendar: current.calendar,
      today,
      settings: s.settings,
      allocations: s.allocations,
      expenses: s.expenses,
      recurring: s.recurring,
      goals: s.goals,
      contributions: s.contributions,
    });
  }, [snapshot.data, current, today]);

  return {
    data,
    recurringItems,
    hasAllocations: (snapshot.data?.allocations.length ?? 0) > 0,
    isPending: snapshot.isPending,
    isError: snapshot.isError,
    refetch: () => void snapshot.refetch(),
  };
}
