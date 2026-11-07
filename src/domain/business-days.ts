/**
 * Mexican bank business days (spec 007, FR-008/FR-009, research.md R1). Pure; no network.
 *
 * Bank holidays every year: Jan 1, first Monday of Feb, third Monday of Mar, Holy Thursday and
 * Good Friday, May 1, Sep 16, Nov 2, third Monday of Nov, Dec 12 and Dec 25. One-off holidays
 * (e.g. Oct 1 on a change of government) are out of scope.
 */
import { addDays, isoDate, parseIsoDate } from "./dates";
import type { IsoDate } from "./types";

/** Gregorian Easter Sunday (anonymous / Meeus–Jones–Butcher algorithm). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

/** 0 = Sunday … 6 = Saturday. */
function weekday(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The `n`-th Monday (1-based) of a month. */
function nthMonday(year: number, month: number, n: number): IsoDate {
  const first = isoDate(year, month, 1);
  const toMonday = (8 - weekday(first)) % 7;
  return addDays(first, toMonday + 7 * (n - 1));
}

const cache = new Map<number, ReadonlySet<IsoDate>>();

export function bankHolidays(year: number): ReadonlySet<IsoDate> {
  const cached = cache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const set: ReadonlySet<IsoDate> = new Set([
    isoDate(year, 1, 1),
    nthMonday(year, 2, 1),
    nthMonday(year, 3, 3),
    addDays(easter, -3),
    addDays(easter, -2),
    isoDate(year, 5, 1),
    isoDate(year, 9, 16),
    isoDate(year, 11, 2),
    nthMonday(year, 11, 3),
    isoDate(year, 12, 12),
    isoDate(year, 12, 25),
  ]);
  cache.set(year, set);
  return set;
}

export function isBusinessDay(date: IsoDate): boolean {
  const w = weekday(date);
  if (w === 0 || w === 6) return false;
  return !bankHolidays(parseIsoDate(date).year).has(date);
}

/** `date` if it is a business day; otherwise the closest business day before it. */
export function previousBusinessDay(date: IsoDate): IsoDate {
  let current = date;
  while (!isBusinessDay(current)) current = addDays(current, -1);
  return current;
}
