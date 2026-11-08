/**
 * Credit cards (FR-013a/b, FR-028/029, research.md R13).
 *
 * Statement calendar (card-terms.ts): cut-off on clampChargeDay(y, m, cutOffDay); payment due =
 * cut-off + paymentDueOffsetDays, moved back to the previous business day (spec 007, FR-010). A card purchase lowers its bucket the day it happens (that's an Expense)
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
import { cardTermsOf, cutOffIn, dueDateFor, lastCutOffOn, type CardTerms } from "./card-terms";
import { addMonthsToMonthStart, parseIsoDate } from "./dates";
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

function requireCard(card: Account): CardTerms {
  const terms = cardTermsOf(card);
  if (!terms) throw new InvalidDateError(`Account ${card.id} is not a configured credit card`);
  return terms;
}

export { lastCutOffOn };

export function cardStatus(card: Account, data: CardData, today: IsoDate): CardStatus {
  const terms = requireCard(card);
  const lastCutOff = lastCutOffOn(terms.cutOffDay, today);
  const nextPaymentDue = dueDateFor(terms, lastCutOff);

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

// ---------------------------------------------------------------------------
// Statement summary (spec 008, US3, research.md R4): one answer for Credit and Expenses
// ---------------------------------------------------------------------------
export type StatementState = "paid" | "pending" | "overdue";

export interface CardStatementSummary {
  cardId: Account["id"];
  /** The statement that closed on the latest cut-off ≤ today. */
  last: { cutOff: IsoDate; due: IsoDate; outstanding: Cents; state: StatementState };
  /** The following statement, projected with what is known today (same rule as the timeline). */
  next: { cutOff: IsoDate; due: IsoDate; amount: Cents };
  totalDebt: Cents;
  /** Which statement leads: the last one until it's paid, then the next one. */
  headline: "last" | "next";
  /** What "Pay" suggests: the headline statement's amount. */
  payAmount: Cents;
}

export function cardStatementSummary(
  card: Account,
  data: CardData,
  today: IsoDate,
): CardStatementSummary {
  const terms = requireCard(card);
  const status = cardStatus(card, data, today);
  const outstanding = status.payToAvoidInterest;
  const state: StatementState =
    outstanding === 0 ? "paid" : today > status.nextPaymentDue ? "overdue" : "pending";

  const nextCutOff = cutOffIn(terms.cutOffDay, addMonthsToMonthStart(status.lastCutOff, 1));
  // Incremental, like creditTimeline: what the next statement adds, assuming this one is paid.
  const cumulative = cardStatus(card, data, nextCutOff).payToAvoidInterest;
  const nextAmount = Math.max(0, cumulative - outstanding) as Cents;

  const headline = state === "paid" ? "next" : "last";
  return {
    cardId: card.id,
    last: { cutOff: status.lastCutOff, due: status.nextPaymentDue, outstanding, state },
    next: { cutOff: nextCutOff, due: dueDateFor(terms, nextCutOff), amount: nextAmount },
    totalDebt: status.totalDebt,
    headline,
    payAmount: headline === "last" ? outstanding : nextAmount,
  };
}

// ---------------------------------------------------------------------------
// Timeline (FR-028): paydays × card due dates × suggested collections
// ---------------------------------------------------------------------------
export type TimelineEventKind = "payday" | "card_due" | "collection_due";

export interface TimelineEvent {
  date: IsoDate;
  kind: TimelineEventKind;
  /** Card name / debtor name; "" for paydays (the UI names them). */
  label: string;
  /** card_due: pay-to-avoid-interest of that statement; collection_due: still owed; payday: null. */
  amount: Cents | null;
  /** Card id or installment id (null for paydays). Extension of the contract, for links/keys. */
  refId: Account["id"] | null;
}

const KIND_ORDER: Record<TimelineEventKind, number> = { payday: 0, collection_due: 1, card_due: 2 };

/** Months (first day) overlapping [from, to], plus `before` earlier ones. */
function monthsBetween(
  from: IsoDate,
  to: IsoDate,
  before = 0,
): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  let { year, month } = parseIsoDate(from);
  for (let i = 0; i < before; i++) [year, month] = month === 1 ? [year - 1, 12] : [year, month - 1];
  const end = parseIsoDate(to);
  while (year < end.year || (year === end.year && month <= end.month)) {
    out.push({ year, month });
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  return out;
}

/**
 * Events between `from` and `to` (inclusive), by date. A card's future statements are projected
 * with what is known today: purchases up to that cut-off and its MSI installments. The first one
 * includes anything unpaid; later ones only their own new charges.
 */
export function creditTimeline(
  s: Pick<
    FinanceSnapshot,
    | "settings"
    | "accounts"
    | "expenses"
    | "cardPayments"
    | "debtors"
    | "receivables"
    | "installments"
  >,
  from: IsoDate,
  to: IsoDate,
): TimelineEvent[] {
  if (from > to) return [];
  const inRange = (date: IsoDate) => date >= from && date <= to;
  const events: TimelineEvent[] = [];

  for (const { year, month } of monthsBetween(from, to)) {
    for (const day of new Set([s.settings.firstPayday, s.settings.secondPayday])) {
      const date = clampChargeDay(year, month, day);
      if (inRange(date))
        events.push({ date, kind: "payday", label: "", amount: null, refId: null });
    }
  }

  // Due dates fall up to 60 days after the cut-off: start two months earlier. The first statement
  // in range carries everything still unpaid (its cumulative pay-to-avoid-interest); each later
  // one only what it adds, assuming the previous one is paid on time — otherwise the same debt
  // would be listed twice.
  for (const card of s.accounts) {
    if (card.kind !== "credit_card" || card.archived) continue;
    const terms = requireCard(card);
    let previous: number | null = null;
    for (const { year, month } of monthsBetween(from, to, 2)) {
      const cutOff = clampChargeDay(year, month, terms.cutOffDay);
      const due = dueDateFor(terms, cutOff);
      if (due < from) continue;
      if (due > to) break;
      const cumulative = cardStatus(card, s, cutOff).payToAvoidInterest;
      events.push({
        date: due,
        kind: "card_due",
        label: card.name,
        amount: Math.max(0, cumulative - (previous ?? 0)) as Cents,
        refId: card.id,
      });
      previous = cumulative;
    }
  }

  const receivables = new Map(s.receivables.map((r) => [r.id, r]));
  const debtors = new Map(s.debtors.map((x) => [x.id, x.name]));
  for (const n of s.installments) {
    if (n.collected >= n.amount || !inRange(n.dueOn)) continue;
    const debtorId = receivables.get(n.receivableId)?.debtorId;
    events.push({
      date: n.dueOn,
      kind: "collection_due",
      label: (debtorId && debtors.get(debtorId)) || "",
      amount: (n.amount - n.collected) as Cents,
      refId: n.id,
    });
  }

  return events.sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}
