/**
 * Credit cards (FR-013a/b, FR-028/029, research.md R13).
 *
 * Statement calendar: cut-off on clampChargeDay(y, m, cutOffDay); payment due = cut-off +
 * paymentDueOffsetDays. A card purchase lowers its bucket the day it happens (that's an Expense)
 * and raises the card's debt; a card payment settles debt and never touches the buckets.
 *
 *   totalDebt          = Σ purchases with the card + Σ full MSI totals on the card − Σ payments  (≥ 0)
 *   payToAvoidInterest = Σ purchases dated ≤ last cut-off
 *                      + Σ MSI installments billed up to this statement (cardDueOn ≤ its due date)
 *                      − Σ payments                                                          (≥ 0)
 *
 * Deviation from contracts/domain-engine.ts: the contract subtracted only payments made AFTER the
 * cut-off, which re-counts every earlier statement that was paid before it. The cumulative form
 * above is identical on a fresh card (US10-1a: $5,000) and correct over any history. Future MSI
 * installments are never part of the "totalero" amount, but always part of the total debt.
 */
import { addDays, parseIsoDate } from "./dates";
import { InvalidDateError } from "./errors";
import { clampChargeDay } from "./periods";
import type { Account, Cents, FinanceSnapshot, IsoDate } from "./types";

export interface CardStatus {
  cardId: Account["id"];
  totalDebt: Cents;
  lastCutOff: IsoDate;
  /** Due date of the statement that closed on `lastCutOff` (may already be past). */
  nextPaymentDue: IsoDate;
  payToAvoidInterest: Cents;
  /** The statement's due date has passed and it isn't fully paid. */
  overdue: boolean;
}

type CardData = Pick<FinanceSnapshot, "expenses" | "cardPayments" | "receivables" | "installments">;

function requireCard(card: Account): { cutOffDay: number; offset: number } {
  if (
    card.kind !== "credit_card" ||
    card.cutOffDay === null ||
    card.paymentDueOffsetDays === null
  ) {
    throw new InvalidDateError(`Account ${card.id} is not a configured credit card`);
  }
  return { cutOffDay: card.cutOffDay, offset: card.paymentDueOffsetDays };
}

/** Latest cut-off on or before `today`. */
export function lastCutOffOn(cutOffDay: number, today: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(today);
  const thisMonth = clampChargeDay(year, month, cutOffDay);
  if (thisMonth <= today) return thisMonth;
  return month === 1
    ? clampChargeDay(year - 1, 12, cutOffDay)
    : clampChargeDay(year, month - 1, cutOffDay);
}

export function cardStatus(card: Account, data: CardData, today: IsoDate): CardStatus {
  const { cutOffDay, offset } = requireCard(card);
  const lastCutOff = lastCutOffOn(cutOffDay, today);
  const nextPaymentDue = addDays(lastCutOff, offset);

  let purchases = 0;
  let billedPurchases = 0;
  for (const e of data.expenses) {
    if (e.paymentAccountId !== card.id) continue;
    purchases += e.amount;
    if (e.spentOn <= lastCutOff) billedPurchases += e.amount;
  }

  let msiTotal = 0;
  const cardReceivables = new Set<string>();
  for (const r of data.receivables) {
    if (r.cardAccountId !== card.id) continue;
    msiTotal += r.total;
    cardReceivables.add(r.id);
  }
  let billedInstallments = 0;
  for (const i of data.installments) {
    if (cardReceivables.has(i.receivableId) && i.cardDueOn <= nextPaymentDue)
      billedInstallments += i.amount;
  }

  let payments = 0;
  for (const p of data.cardPayments) {
    if (p.cardAccountId === card.id) payments += p.amount;
  }

  const payToAvoidInterest = Math.max(0, billedPurchases + billedInstallments - payments);
  return {
    cardId: card.id,
    totalDebt: Math.max(0, purchases + msiTotal - payments) as Cents,
    lastCutOff,
    nextPaymentDue,
    payToAvoidInterest: payToAvoidInterest as Cents,
    overdue: today > nextPaymentDue && payToAvoidInterest > 0,
  };
}
