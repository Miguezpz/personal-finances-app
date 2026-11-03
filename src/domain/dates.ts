/**
 * Calendar arithmetic on business dates (`YYYY-MM-DD`, no time, user's time zone).
 * Pure: never reads the wall clock. Day math uses UTC midnights so DST never shifts a date.
 */
import { InvalidDateError } from "./errors";
import type { IsoDate } from "./types";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export interface DateParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new InvalidDateError(`Month must be 1–12, got ${month}`);
  }
  return month === 2 && isLeapYear(year) ? 29 : (MONTH_DAYS[month - 1] as number);
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Builds a validated IsoDate. */
export function isoDate(year: number, month: number, day: number): IsoDate {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new InvalidDateError(`Year must be 1–9999, got ${year}`);
  }
  const max = daysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > max) {
    throw new InvalidDateError(`Day must be 1–${max} for ${year}-${pad(month, 2)}, got ${day}`);
  }
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate;
}

export function parseIsoDate(date: IsoDate | string): DateParts {
  const m = ISO_RE.exec(date);
  if (!m) throw new InvalidDateError(`Expected YYYY-MM-DD, got "${date}"`);
  const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  isoDate(parts.year, parts.month, parts.day); // validates the calendar date
  return parts;
}

/** Type guard + validation for values coming from forms, storage or the database. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function toIsoDate(value: string): IsoDate {
  parseIsoDate(value);
  return value as IsoDate;
}

function toEpochDay(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function fromEpochDay(epochDay: number): IsoDate {
  const dt = new Date(epochDay * MS_PER_DAY);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) throw new InvalidDateError(`Days must be an integer, got ${days}`);
  return fromEpochDay(toEpochDay(date) + days);
}

/** `to − from` in whole days (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** First day of the month `months` away from `date`'s month. */
export function addMonthsToMonthStart(date: IsoDate, months: number): IsoDate {
  const { year, month } = parseIsoDate(date);
  const index = year * 12 + (month - 1) + months;
  return isoDate(Math.floor(index / 12), (index % 12) + 1, 1);
}

export function monthStart(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date);
  return isoDate(year, month, 1);
}

/** IsoDate strings sort lexicographically in calendar order. */
export const maxIsoDate = (a: IsoDate, b: IsoDate): IsoDate => (a >= b ? a : b);
