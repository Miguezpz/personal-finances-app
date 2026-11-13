/**
 * Credit cards (FR-013a/b, FR-028/029, research.md R13; spec 011 "paid checklist").
 *
 * Statement calendar (card-terms.ts): cut-off on clampChargeDay(y, m, cutOffDay); payment due =
 * cut-off + paymentDueOffsetDays, moved back to the previous business day (spec 007, FR-010). A card
 * purchase lowers its bucket the day it happens (that's an Expense) and raises the card's debt.
 *
 * Spec 011: there are no payment amounts. The owner marks a statement as paid ("Ya la pagué"); the
 * latest marked cut-off L ("paid through") settles everything recorded up to it, so nothing can be
 * over-paid and a later statement never looks paid in advance (research.md R2/R3):
 *
 *   outstanding(C) = Σ purchases with L < spentOn ≤ C + Σ MSI installments with due(L) < cardDueOn ≤ due(C)
 *                    (0 when C ≤ L: the statement is paid)
 *   totalDebt      = Σ purchases with spentOn > L + Σ MSI installments with cardDueOn > due(L)
 */
import { cardTermsOf, cutOffIn, dueDateFor, lastCutOffOn, type CardTerms } from "./card-terms";
import { addDays, addMonthsToMonthStart, parseIsoDate } from "./dates";
import { InvalidDateError } from "./errors";
import { clampChargeDay } from "./periods";
import type { Account, Cents, FinanceSnapshot, IsoDate, StatementMark, Uuid } from "./types";
import { toPrevFridayIfWeekend } from "./pay-calendar";

export interface CardStatus {
  cardId: Account["id"];
  totalDebt: Cents;
  lastCutOff: IsoDate;
  /** Due date of the statement that closed on `lastCutOff` (may already be past). */
  nextPaymentDue: IsoDate;
  payToAvoidInterest: Cents;
  /** The statement's due date has passed and it isn't marked as paid. */
  overdue: boolean;
}

export type CardData = Pick<
  FinanceSnapshot,
  "expenses" | "statementMarks" | "receivables" | "installments"
>;

function requireCard(card: Account): CardTerms {
  const terms = cardTermsOf(card);
  if (!terms) throw new InvalidDateError(`Account ${card.id} is not a configured credit card`);
  return terms;
}

export { lastCutOffOn };

/** The card's latest marked cut-off ("paid through"), or null if it was never marked. */
export function paidThrough(cardId: Uuid, marks: readonly StatementMark[]): IsoDate | null {
  let latest: IsoDate | null = null;
  for (const m of marks) {
    if (m.cardAccountId === cardId && (latest === null || m.cutOff > latest)) latest = m.cutOff;
  }
  return latest;
}

/** What is recorded on the card: its purchases and the installments of its MSI receivables. */
function chargesOf(card: Account, data: CardData) {
  const purchases = data.expenses.filter((e) => e.paymentAccountId === card.id);
  const receivables = new Set(
    data.receivables.filter((r) => r.cardAccountId === card.id).map((r) => r.id),
  );
  const installments = data.installments.filter((i) => receivables.has(i.receivableId));
  return { purchases, installments };
}

type Charges = ReturnType<typeof chargesOf>;

/** Charges billed after the statement `after` (exclusive; null = since ever) up to `upTo` (inclusive). */
function billedBetween(
  terms: CardTerms,
  charges: Charges,
  after: IsoDate | null,
  upTo: IsoDate,
): number {
  const afterDue = after === null ? null : dueDateFor(terms, after);
  const upToDue = dueDateFor(terms, upTo);
  let sum = 0;
  for (const e of charges.purchases) {
    if ((after === null || e.spentOn > after) && e.spentOn <= upTo) sum += e.amount;
  }
  for (const i of charges.installments) {
    if ((afterDue === null || i.cardDueOn > afterDue) && i.cardDueOn <= upToDue) sum += i.amount;
  }
  return sum;
}

/**
 * A closed statement is "paid" once marked; otherwise pending, then overdue after its due date —
 * even with no purchases recorded: the owner's family also uses the cards and isn't recorded, so
 * every statement gets checked off (spec 011, clarification 2026-11-08).
 */
export type StatementState = "paid" | "pending" | "overdue";

export interface StatementView {
  cutOff: IsoDate;
  due: IsoDate;
  /** Days on which this statement can be paid: the day after its cut-off to the day before it's due (FR-025). */
  payRange: { from: IsoDate; to: IsoDate };
  outstanding: Cents;
  state: StatementState;
  /** The card's own mark on exactly this cut-off, if any ("Desmarcar"). */
  markId: Uuid | null;
}

/** One statement of the card: its amount and state as of `today` (spec 011, FR-013). */
export function statementOf(
  card: Account,
  data: CardData,
  cutOff: IsoDate,
  today: IsoDate,
): StatementView {
  const terms = requireCard(card);
  const due = dueDateFor(terms, cutOff);
  const through = paidThrough(card.id, data.statementMarks);
  const markId =
    data.statementMarks.find((m) => m.cardAccountId === card.id && m.cutOff === cutOff)?.id ?? null;
  const paid = through !== null && cutOff <= through;
  const outstanding = paid ? 0 : billedBetween(terms, chargesOf(card, data), through, cutOff);
  const state: StatementState = paid ? "paid" : today > due ? "overdue" : "pending";
  return {
    cutOff,
    due,
    payRange: { from: addDays(cutOff, 1), to: addDays(due, -1) },
    outstanding: outstanding as Cents,
    state,
    markId,
  };
}

export function cardStatus(card: Account, data: CardData, today: IsoDate): CardStatus {
  const terms = requireCard(card);
  const lastCutOff = lastCutOffOn(terms.cutOffDay, today);
  const last = statementOf(card, data, lastCutOff, today);

  const through = paidThrough(card.id, data.statementMarks);
  const throughDue = through === null ? null : dueDateFor(terms, through);
  const charges = chargesOf(card, data);
  let totalDebt = 0;
  for (const e of charges.purchases)
    if (through === null || e.spentOn > through) totalDebt += e.amount;
  for (const i of charges.installments) {
    if (throughDue === null || i.cardDueOn > throughDue) totalDebt += i.amount;
  }

  return {
    cardId: card.id,
    totalDebt: totalDebt as Cents,
    lastCutOff,
    nextPaymentDue: last.due,
    payToAvoidInterest: last.outstanding,
    overdue: last.state === "overdue",
  };
}

// ---------------------------------------------------------------------------
// Statement summary (spec 008, US3, research.md R4): one answer for Credit and Expenses
// ---------------------------------------------------------------------------
export interface CardStatementSummary {
  cardId: Account["id"];
  /** The statement that closed on the latest cut-off ≤ today. */
  last: StatementView;
  /** The following statement, projected with what is known today (same rule as the timeline). */
  next: { cutOff: IsoDate; due: IsoDate; amount: Cents };
  totalDebt: Cents;
  /** Which statement leads: the last one until it's marked as paid, then the next one. */
  headline: "last" | "next";
}

export function cardStatementSummary(
  card: Account,
  data: CardData,
  today: IsoDate,
): CardStatementSummary {
  const terms = requireCard(card);
  const status = cardStatus(card, data, today);
  const last = statementOf(card, data, status.lastCutOff, today);

  const nextCutOff = cutOffIn(terms.cutOffDay, addMonthsToMonthStart(status.lastCutOff, 1));
  // What the next statement adds, assuming this one gets paid.
  const through = paidThrough(card.id, data.statementMarks);
  const from = through !== null && through > status.lastCutOff ? through : status.lastCutOff;
  const nextAmount = billedBetween(terms, chargesOf(card, data), from, nextCutOff) as Cents;

  return {
    cardId: card.id,
    last,
    next: { cutOff: nextCutOff, due: dueDateFor(terms, nextCutOff), amount: nextAmount },
    totalDebt: status.totalDebt,
    headline: last.state === "paid" ? "next" : "last",
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
  /** card_due only: the statement is marked as paid (spec 011, FR-017). */
  paid?: boolean;
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
    | "statementMarks"
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
      const date = toPrevFridayIfWeekend(clampChargeDay(year, month, day)); // spec 006
      if (inRange(date))
        events.push({ date, kind: "payday", label: "", amount: null, refId: null });
    }
  }

  // Due dates fall up to 60 days after the cut-off: start two months earlier. The first statement
  // in range carries everything still unpaid since the last marked one; each later one only what it
  // adds, assuming the previous one gets paid — otherwise the same debt would be listed twice.
  for (const card of s.accounts) {
    if (card.kind !== "credit_card" || card.archived) continue;
    const terms = requireCard(card);
    const charges = chargesOf(card, s);
    const through = paidThrough(card.id, s.statementMarks);
    let previous: IsoDate | null = null;
    for (const { year, month } of monthsBetween(from, to, 2)) {
      const cutOff = clampChargeDay(year, month, terms.cutOffDay);
      const due = dueDateFor(terms, cutOff);
      if (due < from) continue;
      if (due > to) break;
      const paid = through !== null && cutOff <= through;
      const since =
        previous !== null && (through === null || previous > through) ? previous : through;
      events.push({
        date: due,
        kind: "card_due",
        label: card.name,
        amount: (paid ? 0 : billedBetween(terms, charges, since, cutOff)) as Cents,
        refId: card.id,
        paid,
      });
      previous = cutOff;
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
