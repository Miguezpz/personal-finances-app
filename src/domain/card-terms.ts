/**
 * Credit card terms (spec 007, research.md R2–R4/R7): everything derived from a card's
 * `(cutOffDay, paymentDueOffsetDays)` lives here, so the due date is computed in one place
 * (FR-008).
 *
 *  - Cut-off: clampChargeDay(year, month, cutOffDay); never moved for holidays.
 *  - Due date: cut-off + offset, moved back to the previous business day (business-days.ts). If
 *    moving back would land on or before the cut-off (offsets of 1–4 days), the nominal date is
 *    used instead (data-model.md invariant 2).
 *  - MSI installment k of a purchase is billed k−1 statements after the first cut-off ≥ the
 *    purchase date; the debtor is asked to pay max(1, lead) days before the card's due date.
 */
import { previousBusinessDay, isBusinessDay } from "./business-days";
import { addDays, addMonthsToMonthStart, daysBetween, daysInMonth, parseIsoDate } from "./dates";
import { clampChargeDay } from "./periods";
import type { Account, Installment, IsoDate, Receivable, Uuid } from "./types";

export const MAX_DUE_OFFSET_DAYS = 60;

export interface CardTerms {
  cutOffDay: number;
  paymentDueOffsetDays: number;
}

export interface Statement {
  cutOffOn: IsoDate;
  dueOn: IsoDate;
}

export type StatementError = "dueNotAfterCutOff" | "dueTooFar";
export type StatementWarning = "dueMayHaveMoved" | "shortMonthCutOff";

export interface InstallmentDates {
  id: Uuid;
  dueOn: IsoDate;
  cardDueOn: IsoDate;
}

export function cardTermsOf(
  a: Pick<Account, "kind" | "cutOffDay" | "paymentDueOffsetDays">,
): CardTerms | null {
  if (a.kind !== "credit_card" || a.cutOffDay === null || a.paymentDueOffsetDays === null) {
    return null;
  }
  return { cutOffDay: a.cutOffDay, paymentDueOffsetDays: a.paymentDueOffsetDays };
}

/** The cut-off of the month containing `anyDateInMonth`. */
export function cutOffIn(cutOffDay: number, anyDateInMonth: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(anyDateInMonth);
  return clampChargeDay(year, month, cutOffDay);
}

/** Latest cut-off on or before `today`. */
export function lastCutOffOn(cutOffDay: number, today: IsoDate): IsoDate {
  const thisMonth = cutOffIn(cutOffDay, today);
  return thisMonth <= today ? thisMonth : cutOffIn(cutOffDay, addMonthsToMonthStart(today, -1));
}

/** Cut-off of the statement a purchase falls into: the first cut-off ≥ purchase date. */
export function statementCutOffFor(cutOffDay: number, purchaseDate: IsoDate): IsoDate {
  const thisMonth = cutOffIn(cutOffDay, purchaseDate);
  return purchaseDate <= thisMonth
    ? thisMonth
    : cutOffIn(cutOffDay, addMonthsToMonthStart(purchaseDate, 1));
}

export function nominalDueDate(terms: CardTerms, cutOffOn: IsoDate): IsoDate {
  return addDays(cutOffOn, terms.paymentDueOffsetDays);
}

/** The statement's payment due date, moved back to a business day (R2, invariant 2). */
export function dueDateFor(terms: CardTerms, cutOffOn: IsoDate): IsoDate {
  const nominal = nominalDueDate(terms, cutOffOn);
  const adjusted = previousBusinessDay(nominal);
  return adjusted > cutOffOn ? adjusted : nominal;
}

export function cardTermsFromStatement(
  cutOffOn: IsoDate,
  dueOn: IsoDate,
): { ok: true; terms: CardTerms } | { ok: false; error: StatementError } {
  const offset = daysBetween(cutOffOn, dueOn);
  if (offset <= 0) return { ok: false, error: "dueNotAfterCutOff" };
  if (offset > MAX_DUE_OFFSET_DAYS) return { ok: false, error: "dueTooFar" };
  return {
    ok: true,
    terms: { cutOffDay: parseIsoDate(cutOffOn).day, paymentDueOffsetDays: offset },
  };
}

/** Non-blocking hints for a statement typed by the owner (FR-006, R4). */
export function statementWarnings(cutOffOn: IsoDate, dueOn: IsoDate): StatementWarning[] {
  const warnings: StatementWarning[] = [];
  if (!isBusinessDay(addDays(dueOn, -1)) || !isBusinessDay(addDays(dueOn, 1))) {
    warnings.push("dueMayHaveMoved");
  }
  const { year, month, day } = parseIsoDate(cutOffOn);
  const length = daysInMonth(year, month);
  if (length < 31 && day === length) warnings.push("shortMonthCutOff");
  return warnings;
}

/** The first `count` statements whose (adjusted) due date is on or after `today`. */
export function upcomingStatements(terms: CardTerms, today: IsoDate, count = 3): Statement[] {
  const out: Statement[] = [];
  // Due dates fall up to 60 days after the cut-off: start three months back.
  const start = addMonthsToMonthStart(today, -3);
  for (let i = 0; out.length < count && i < count + 6; i++) {
    const cutOffOn = cutOffIn(terms.cutOffDay, addMonthsToMonthStart(start, i));
    const dueOn = dueDateFor(terms, cutOffOn);
    if (dueOn >= today) out.push({ cutOffOn, dueOn });
  }
  return out;
}

/**
 * The statement used to prefill the form (FR-005): the latest cut-off on or before `today` whose
 * month is long enough to hold the cut-off day (so days 29–31 round-trip), with its NOMINAL due
 * date, so saving it unchanged gives back the same terms.
 */
export function latestStatement(terms: CardTerms, today: IsoDate): Statement {
  let cutOffOn = lastCutOffOn(terms.cutOffDay, today);
  for (let i = 0; i < 12 && parseIsoDate(cutOffOn).day !== terms.cutOffDay; i++) {
    cutOffOn = lastCutOffOn(terms.cutOffDay, addDays(cutOffOn, -1));
  }
  return { cutOffOn, dueOn: nominalDueDate(terms, cutOffOn) };
}

/** Card due date and debtor collection date of installment `seq` of an MSI purchase. */
export function installmentDatesFor(
  terms: CardTerms,
  purchaseDate: IsoDate,
  seq: number,
  collectionLeadDays: number,
): { dueOn: IsoDate; cardDueOn: IsoDate } {
  const firstCutOff = statementCutOffFor(terms.cutOffDay, purchaseDate);
  const cutOff = cutOffIn(terms.cutOffDay, addMonthsToMonthStart(firstCutOff, seq - 1));
  const cardDueOn = dueDateFor(terms, cutOff);
  return { dueOn: addDays(cardDueOn, -Math.max(1, collectionLeadDays)), cardDueOn };
}

/**
 * The card's not fully collected installments whose dates differ from what its terms give today
 * (FR-011, FR-013). Collected ones never move.
 */
export function rescheduleCardInstallments(
  card: Account,
  receivables: readonly Receivable[],
  installments: readonly Installment[],
  collectionLeadDays: number,
): InstallmentDates[] {
  const terms = cardTermsOf(card);
  if (!terms) return [];
  const purchases = new Map(
    receivables.filter((r) => r.cardAccountId === card.id).map((r) => [r.id, r.purchaseDate]),
  );
  const out: InstallmentDates[] = [];
  for (const i of installments) {
    const purchaseDate = purchases.get(i.receivableId);
    if (purchaseDate === undefined || i.status === "collected") continue;
    const next = installmentDatesFor(terms, purchaseDate, i.seq, collectionLeadDays);
    if (next.dueOn !== i.dueOn || next.cardDueOn !== i.cardDueOn) out.push({ id: i.id, ...next });
  }
  return out;
}
