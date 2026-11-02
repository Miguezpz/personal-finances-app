/**
 * Quincenas (semi-monthly pay periods, research.md R2):
 *   half 1 = days 1–15  → key `YYYY-MM-1`
 *   half 2 = day 16–end → key `YYYY-MM-2`
 * Pure: "today" is always injected (see todayIn).
 */
import { daysBetween, daysInMonth, isoDate, parseIsoDate } from "./dates";
import { InvalidDateError } from "./errors";
import type { IsoDate, Period, PeriodKey, UserSettings } from "./types";

const KEY_RE = /^(\d{4})-(\d{2})-([12])$/;

function makePeriod(year: number, month: number, half: 1 | 2): Period {
  const key =
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${half}` as PeriodKey;
  return half === 1
    ? { key, start: isoDate(year, month, 1), end: isoDate(year, month, 15), half }
    : {
        key,
        start: isoDate(year, month, 16),
        end: isoDate(year, month, daysInMonth(year, month)),
        half,
      };
}

export function periodOf(date: IsoDate): Period {
  const { year, month, day } = parseIsoDate(date);
  return makePeriod(year, month, day <= 15 ? 1 : 2);
}

export function periodFromKey(key: PeriodKey): Period {
  const m = KEY_RE.exec(key);
  if (!m) throw new InvalidDateError(`Expected a period key YYYY-MM-1|2, got "${key}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new InvalidDateError(`Invalid month in period key "${key}"`);
  return makePeriod(year, month, m[3] === "1" ? 1 : 2);
}

export function nextPeriod(period: Period): Period {
  const { year, month } = parseIsoDate(period.start);
  if (period.half === 1) return makePeriod(year, month, 2);
  return month === 12 ? makePeriod(year + 1, 1, 1) : makePeriod(year, month + 1, 1);
}

export function previousPeriod(period: Period): Period {
  const { year, month } = parseIsoDate(period.start);
  if (period.half === 2) return makePeriod(year, month, 1);
  return month === 1 ? makePeriod(year - 1, 12, 2) : makePeriod(year, month - 1, 2);
}

/** Charge day of a recurring expense in a given month; the last day if `day` doesn't exist (FR-009). */
export function clampChargeDay(year: number, month: number, day: number): IsoDate {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new InvalidDateError(`Charge day must be 1–31, got ${day}`);
  }
  return isoDate(year, month, Math.min(day, daysInMonth(year, month)));
}

/**
 * Business date ("today") in the user's IANA time zone for a given instant.
 * @throws RangeError for an unknown time zone.
 */
export function todayIn(timezone: string, now: Date): IsoDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return isoDate(get("year"), get("month"), get("day"));
}

/**
 * Quincena funded by an income received on `receivedOn` (clarification 3, research.md R3): the
 * first period that starts strictly after the date — the 15th funds the 16th–end, the last day
 * funds the 1st–15th of the next month. The user may override it when registering.
 */
export function fundedPeriodFor(receivedOn: IsoDate): Period {
  return nextPeriod(periodOf(receivedOn));
}

/** True if `date` is the first day of a quincena (day 1 or 16). */
export function isPeriodStart(date: IsoDate): boolean {
  const { day } = parseIsoDate(date);
  return day === 1 || day === 16;
}

/**
 * Days from `today` to the next payday (FR-019); 0 when today is a payday. Paydays are days of
 * the month (31 = last day, clamped in short months).
 */
export function daysUntilNextPayday(
  today: IsoDate,
  settings: Pick<UserSettings, "firstPayday" | "secondPayday">,
): number {
  const { year, month } = parseIsoDate(today);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  let best = Number.POSITIVE_INFINITY;
  for (const m of [{ year, month }, next]) {
    for (const day of [settings.firstPayday, settings.secondPayday]) {
      const diff = daysBetween(today, clampChargeDay(m.year, m.month, day));
      if (diff >= 0 && diff < best) best = diff;
    }
  }
  return best;
}
