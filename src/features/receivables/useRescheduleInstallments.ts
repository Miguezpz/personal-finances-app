"use client";

/**
 * Keeps not-collected MSI installments on their card's current calendar (spec 007, FR-013,
 * research.md R7): when the app opens, the first active card whose installments differ from what
 * its terms give today (business-day rule, collection lead from Settings) is rescheduled through
 * the same atomic write as a card edit. Idempotent: once the dates match, `plan` is null. Never
 * runs in the demo (`useBackgroundSync`).
 */
import { type BackgroundSync, useBackgroundSync } from "@/data/background-sync";
import { rescheduleCardInstallments, type InstallmentDates } from "@/domain/card-terms";
import type { FinanceSnapshot, Uuid } from "@/domain/types";
import { applyInstallmentDates } from "@/features/settings/accounts/hooks";

export interface ReschedulePlan {
  cardId: Uuid;
  changes: InstallmentDates[];
}

/** The first active card with installments to reschedule, or null (pure; exported for tests). */
export function reschedulePlan(
  s: Pick<FinanceSnapshot, "accounts" | "receivables" | "installments" | "settings">,
): ReschedulePlan | null {
  for (const card of s.accounts) {
    if (card.kind !== "credit_card" || card.archived) continue;
    const changes = rescheduleCardInstallments(
      card,
      s.receivables,
      s.installments,
      s.settings.collectionLeadDays,
    );
    if (changes.length > 0) return { cardId: card.id, changes };
  }
  return null;
}

const RESCHEDULE_SYNC: BackgroundSync<ReschedulePlan, ReschedulePlan> = {
  plan: (snapshot) => reschedulePlan(snapshot),
  write: async (provider, plan) => {
    await provider.accounts.update(plan.cardId, {}, plan.changes);
    return plan;
  },
  merge: (current, plan) => applyInstallmentDates(current, plan.changes),
};

export function useRescheduleInstallments(): void {
  useBackgroundSync(RESCHEDULE_SYNC);
}
