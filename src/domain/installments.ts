/**
 * MSI purchases for third parties (US5, FR-022…FR-026a, research.md R13).
 *
 * Calendar (shared with credit.ts and the demo seed):
 *  - A purchase is billed on the first statement whose cut-off is ≥ the purchase date (a purchase
 *    on the cut-off day closes with that statement).
 *  - Installment k (1..N) is billed k−1 statements later: cardDueOn = dueDateFor(that cut-off),
 *    i.e. cut-off + offset days moved back to a business day (card-terms.ts, spec 007).
 *  - The debtor is asked to pay `collectionLeadDays` before: dueOn = cardDueOn − lead, with at least
 *    one day of lead so dueOn < cardDueOn always holds (FR-024; settings allow 0).
 *  - Equal installments; the cents remainder goes on the last one (Σ = total, SC-006).
 * Collections never touch any bucket: they only reduce what the debtor owes (FR-026a).
 */
import { installmentDatesFor, statementCutOffFor } from "./card-terms";
import { addDays, daysBetween } from "./dates";
import { InvalidDateError, InvalidMoneyError } from "./errors";
import type { Account, Cents, Installment, IsoDate, Receivable } from "./types";

/** Alerts cover overdue collections and the next 7 days (fixed, FR-025). */
export const COLLECTION_ALERT_WINDOW_DAYS = 7 as const;
export const MAX_TERM_MONTHS = 48;

export function splitInstallments(total: Cents, termMonths: number): Cents[] {
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > MAX_TERM_MONTHS) {
    throw new InvalidMoneyError(`Term must be 1–${MAX_TERM_MONTHS} months, got ${termMonths}`);
  }
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new InvalidMoneyError(`Total must be a positive number of cents, got ${total}`);
  }
  const base = Math.floor(total / termMonths);
  return Array.from(
    { length: termMonths },
    (_, i) => (i === termMonths - 1 ? total - base * (termMonths - 1) : base) as Cents,
  );
}

export interface ScheduledInstallment {
  seq: number;
  /** Suggested collection date from the debtor. */
  dueOn: IsoDate;
  /** Card payment due date for this installment. */
  cardDueOn: IsoDate;
  amount: Cents;
}

export { installmentDatesFor, statementCutOffFor };

export function buildCollectionSchedule(
  card: Pick<Account, "cutOffDay" | "paymentDueOffsetDays">,
  total: Cents,
  termMonths: number,
  purchaseDate: IsoDate,
  collectionLeadDays: number,
): ScheduledInstallment[] {
  if (card.cutOffDay === null || card.paymentDueOffsetDays === null) {
    throw new InvalidDateError("The card has no cut-off day / payment due offset configured");
  }
  const terms = { cutOffDay: card.cutOffDay, paymentDueOffsetDays: card.paymentDueOffsetDays };
  return splitInstallments(total, termMonths).map((amount, i) => ({
    seq: i + 1,
    ...installmentDatesFor(terms, purchaseDate, i + 1, collectionLeadDays),
    amount,
  }));
}

const owed = (i: Pick<Installment, "amount" | "collected">) => i.amount - i.collected;

/** What a debtor still owes across all their purchases (US5-7). */
export function debtorBalance(
  installments: readonly Installment[],
  receivables: readonly Receivable[],
  debtorId: Receivable["debtorId"],
): Cents {
  const ids = new Set(receivables.filter((r) => r.debtorId === debtorId).map((r) => r.id));
  return installments.reduce((s, i) => (ids.has(i.receivableId) ? s + owed(i) : s), 0) as Cents;
}

/** What is still owed for one purchase. */
export function receivableBalance(
  installments: readonly Installment[],
  receivableId: Receivable["id"],
): Cents {
  return installments.reduce(
    (s, i) => (i.receivableId === receivableId ? s + owed(i) : s),
    0,
  ) as Cents;
}

export interface CollectionAlert {
  installmentId: Installment["id"];
  receivableId: Receivable["id"];
  debtorId: Receivable["debtorId"];
  amountDue: Cents;
  dueOn: IsoDate;
  /** Negative = overdue. */
  daysUntilDue: number;
}

/** Not fully collected installments due on or before today + windowDays, soonest first. */
export function collectionAlerts(
  installments: readonly Installment[],
  receivables: readonly Receivable[],
  today: IsoDate,
  windowDays: number,
): CollectionAlert[] {
  const byId = new Map(receivables.map((r) => [r.id, r]));
  const limit = addDays(today, windowDays);
  const alerts: CollectionAlert[] = [];
  for (const i of installments) {
    const receivable = byId.get(i.receivableId);
    if (!receivable || owed(i) <= 0 || i.dueOn > limit) continue;
    alerts.push({
      installmentId: i.id,
      receivableId: receivable.id,
      debtorId: receivable.debtorId,
      amountDue: owed(i) as Cents,
      dueOn: i.dueOn,
      daysUntilDue: daysBetween(today, i.dueOn),
    });
  }
  return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/** Status derived from the collected amount (mirrors the DB CHECK). */
export function installmentStatusFor(collected: number, amount: number): Installment["status"] {
  if (collected <= 0) return "pending";
  return collected < amount ? "partial" : "collected";
}
