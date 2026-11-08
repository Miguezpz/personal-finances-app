"use client";

/** Every active credit card with its statement summary (spec 008, US3, FR-021): the one source
 * Credit and Expenses read, so both show the same amount and date. */
import { useMemo } from "react";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { cardStatementSummary, type CardStatementSummary } from "@/domain/credit";
import { nextPaymentSession } from "@/domain/payment-sessions";
import type { Account, FinanceSnapshot } from "@/domain/types";
import { useToday } from "@/lib/use-today";

export interface CardStatement {
  card: Account;
  summary: CardStatementSummary;
}

const selectAll = (s: FinanceSnapshot) => s;

export function useCardStatements(): CardStatement[] | undefined {
  const today = useToday();
  const { data } = useFinanceSnapshot(selectAll);
  return useMemo(
    () =>
      data?.accounts
        .filter((a) => a.kind === "credit_card" && !a.archived)
        .map((card) => ({ card, summary: cardStatementSummary(card, data, today) })),
    [data, today],
  );
}

/** The monthly payment session (spec 011, US5): this cycle's sessions and the next unfinished one. */
export function usePaymentSession(): ReturnType<typeof nextPaymentSession> | undefined {
  const today = useToday();
  const { data } = useFinanceSnapshot(selectAll);
  return useMemo(
    () => (data ? nextPaymentSession(data.accounts, data, data.settings, today) : undefined),
    [data, today],
  );
}
