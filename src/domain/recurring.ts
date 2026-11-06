/**
 * Recurring expenses (US3, FR-007…FR-011, research.md R5).
 *
 * One occurrence per recurring expense per calendar month, on clampChargeDay(y, m, chargeDay)
 * (day 31 → last day, FR-009), inside [startsOn, endedOn] (inclusive). Applied occurrences live
 * in `expenses` as snapshots (origin 'recurring'); a month that already has one is never charged
 * again — even if the charge day or amount was edited afterwards (FR-011). Pure: "today" is
 * always injected.
 */
import { addMonthsToMonthStart, monthStart, parseIsoDate } from "./dates";
import { clampChargeDay } from "./periods";
import type { Cents, Expense, IsoDate, Period, RecurringExpense, SpendBucket } from "./types";

export interface RecurringOccurrence {
  recurringExpenseId: RecurringExpense["id"];
  occurrenceDate: IsoDate;
  amount: Cents;
  bucket: SpendBucket;
}

type Applied = Pick<Expense, "recurringExpenseId" | "occurrenceDate">;

const monthKey = (date: IsoDate) => date.slice(0, 7);

/** "recurringId|YYYY-MM" of every applied occurrence. */
function appliedMonths(applied: readonly Applied[]): Set<string> {
  const keys = new Set<string>();
  for (const e of applied) {
    if (e.recurringExpenseId && e.occurrenceDate) {
      keys.add(`${e.recurringExpenseId}|${monthKey(e.occurrenceDate)}`);
    }
  }
  return keys;
}

const isActiveOn = (r: RecurringExpense, date: IsoDate) =>
  date >= r.startsOn && (r.endedOn === null || date <= r.endedOn);

/** Occurrences of `r` from the month of `from` to the month of `to` (both inclusive), in range. */
function occurrencesBetween(r: RecurringExpense, from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let m = monthStart(from); m <= to; m = addMonthsToMonthStart(m, 1)) {
    const { year, month } = parseIsoDate(m);
    const date = clampChargeDay(year, month, r.chargeDay);
    if (date >= from && date <= to && isActiveOn(r, date)) out.push(date);
  }
  return out;
}

const toOccurrence = (r: RecurringExpense, occurrenceDate: IsoDate): RecurringOccurrence => ({
  recurringExpenseId: r.id,
  occurrenceDate,
  amount: r.amount,
  bucket: r.bucket,
});

/**
 * Every occurrence with date ≤ today, inside [startsOn, endedOn], whose month isn't applied yet.
 * Idempotent: once the result is inserted, calling again returns nothing (FR-010, SC-005).
 */
export function dueOccurrences(
  recurring: readonly RecurringExpense[],
  applied: readonly Applied[],
  today: IsoDate,
): RecurringOccurrence[] {
  const done = appliedMonths(applied);
  const due: RecurringOccurrence[] = [];
  for (const r of recurring) {
    if (r.startsOn > today) continue;
    for (const date of occurrencesBetween(r, r.startsOn, today)) {
      if (!done.has(`${r.id}|${monthKey(date)}`)) due.push(toOccurrence(r, date));
    }
  }
  return due.sort((a, b) =>
    a.occurrenceDate < b.occurrenceDate ? -1 : a.occurrenceDate > b.occurrenceDate ? 1 : 0,
  );
}

/** Unapplied occurrences of the quincena with date > today: shown as "pending" (FR-008a). */
export function pendingOccurrences(
  recurring: readonly RecurringExpense[],
  applied: readonly Applied[],
  period: Period,
  today: IsoDate,
): RecurringOccurrence[] {
  return unappliedOccurrences(recurring, applied, period).filter((o) => o.occurrenceDate > today);
}

/**
 * Every unapplied occurrence of the quincena, whatever its date. The Safe-to-Spend reserves all of
 * them: future ones are pending, and a past-due one is about to be materialized — either way the
 * money is spoken for, and the balance doesn't change when it becomes applied (FR-008a).
 */
export function unappliedOccurrences(
  recurring: readonly RecurringExpense[],
  applied: readonly Applied[],
  period: Period,
): RecurringOccurrence[] {
  const done = appliedMonths(applied);
  const out: RecurringOccurrence[] = [];
  for (const r of recurring) {
    for (const date of occurrencesBetween(r, period.start, period.end)) {
      if (!done.has(`${r.id}|${monthKey(date)}`)) out.push(toOccurrence(r, date));
    }
  }
  return out.sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? -1 : 1));
}

export interface RecurringStatusItem {
  recurringExpenseId: RecurringExpense["id"];
  name: string;
  date: IsoDate;
  amount: Cents;
  bucket: SpendBucket;
  status: "applied" | "pending";
}

/**
 * Recurring charges of the quincena for display: applied ones with their snapshot amount, and
 * unapplied ones as pending. Sorted by date.
 */
export function recurringStatusForPeriod(
  recurring: readonly RecurringExpense[],
  expenses: readonly Expense[],
  period: Period,
): RecurringStatusItem[] {
  const byId = new Map(recurring.map((r) => [r.id, r]));
  const items: RecurringStatusItem[] = [];
  for (const e of expenses) {
    if (e.origin !== "recurring" || !e.recurringExpenseId) continue;
    if (e.spentOn < period.start || e.spentOn > period.end) continue;
    const r = byId.get(e.recurringExpenseId);
    if (!r) continue;
    items.push({
      recurringExpenseId: r.id,
      name: r.name,
      date: e.spentOn,
      amount: e.amount,
      bucket: e.bucket,
      status: "applied",
    });
  }
  for (const o of unappliedOccurrences(recurring, expenses, period)) {
    const r = byId.get(o.recurringExpenseId) as RecurringExpense;
    items.push({ ...o, name: r.name, date: o.occurrenceDate, status: "pending" });
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Next charge date of a recurring expense on or after `from`, or null if it's ended. */
export function nextChargeDate(r: RecurringExpense, from: IsoDate): IsoDate | null {
  const start = from > r.startsOn ? from : r.startsOn;
  // Within 13 months there is always a charge unless it has ended.
  const horizon = addMonthsToMonthStart(start, 13);
  return occurrencesBetween(r, start, horizon)[0] ?? null;
}

/**
 * How many past charges saving `r` with `startsOn` would create right away (the background sync
 * materializes every due, unapplied month). Used to warn before backdating the start date.
 */
export function retroactiveChargeCount(
  r: RecurringExpense,
  startsOn: IsoDate,
  applied: readonly Applied[],
  today: IsoDate,
): number {
  return dueOccurrences([{ ...r, startsOn }], applied, today).length;
}
