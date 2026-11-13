/**
 * Pay calendar (spec 006, research.md R1–R4, R7): a quincena starts on the day the money that funds
 * it arrives and ends the day before the next one starts.
 *   expected start = the configured payday that funds it (the lower one opens half 2 of month M,
 *                    the higher one opens half 1 of M+1), clamped, moved to Friday on weekends
 *   actual start   = the earliest salary income funding it, if within ±7 days of the expected one
 *                    and strictly between the neighbours' expected starts (FR-004, FR-005)
 * Bank holidays are out of scope: the income date covers them. Derived, never stored. Pure.
 */
import { addDays, daysBetween, parseIsoDate } from "./dates";
import { clampChargeDay, nextPeriod, periodOf, previousPeriod } from "./periods";
import type { Income, IsoDate, Period, PeriodKey, UserSettings } from "./types";

type Paydays = Pick<UserSettings, "firstPayday" | "secondPayday">;

export interface PayCalendar {
  settings: Paydays;
  /** Valid salary overrides: effective start by quincena. */
  overrides: ReadonlyMap<PeriodKey, IsoDate>;
}

const OVERRIDE_WINDOW_DAYS = 7;

/** Saturday → Friday (−1), Sunday → Friday (−2); weekdays unchanged. */
export function toPrevFridayIfWeekend(date: IsoDate): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 6 ? addDays(date, -1) : weekday === 0 ? addDays(date, -2) : date;
}

/** Configured payday that funds `period`, clamped but not moved off weekends. */
export function nominalPayday(period: Period, settings: Paydays): IsoDate {
  const { year, month } = parseIsoDate(period.start);
  const low = Math.min(settings.firstPayday, settings.secondPayday);
  const high = Math.max(settings.firstPayday, settings.secondPayday);
  if (period.half === 2) return clampChargeDay(year, month, low);
  const prev = parseIsoDate(previousPeriod(period).start);
  return clampChargeDay(prev.year, prev.month, high);
}

export function expectedStart(period: Period, settings: Paydays): IsoDate {
  return toPrevFridayIfWeekend(nominalPayday(period, settings));
}

export function buildPayCalendar(settings: Paydays, incomes: readonly Income[]): PayCalendar {
  const overrides = new Map<PeriodKey, IsoDate>();
  for (const income of incomes) {
    if (income.incomeType !== "salary") continue;
    const period = periodOf(income.fundedPeriodStart);
    const expected = expectedStart(period, settings);
    if (Math.abs(daysBetween(expected, income.receivedOn)) > OVERRIDE_WINDOW_DAYS) continue;
    if (income.receivedOn <= expectedStart(previousPeriod(period), settings)) continue;
    if (income.receivedOn >= expectedStart(nextPeriod(period), settings)) continue;
    const current = overrides.get(period.key);
    if (!current || income.receivedOn < current) overrides.set(period.key, income.receivedOn);
  }
  return { settings, overrides };
}

const effectiveStart = (period: Period, cal: PayCalendar): IsoDate =>
  cal.overrides.get(period.key) ?? expectedStart(period, cal.settings);

/** `period` with its effective range. */
export function withRange(period: Period, cal: PayCalendar): Period {
  return {
    ...period,
    from: effectiveStart(period, cal),
    to: addDays(effectiveStart(nextPeriod(period), cal), -1),
  };
}

/** Effective quincena containing `date`. */
export function periodOfDate(date: IsoDate, cal: PayCalendar): Period {
  let period = periodOf(date);
  while (date < effectiveStart(period, cal)) period = previousPeriod(period);
  while (date >= effectiveStart(nextPeriod(period), cal)) period = nextPeriod(period);
  return withRange(period, cal);
}

/** 0 on the day a quincena starts; otherwise days until the next one starts (FR-010). */
export function daysUntilNextPayday(today: IsoDate, cal: PayCalendar): number {
  const period = periodOfDate(today, cal);
  return today === period.from ? 0 : daysBetween(today, period.to) + 1;
}

/**
 * Quincena an income received on `receivedOn` most likely funds: the one whose expected payday is
 * closest, ties to the later one (FR-012). The user can still change it when registering.
 */
export function fundedPeriodFor(receivedOn: IsoDate, settings: Paydays): Period {
  const here = periodOf(receivedOn);
  let best = nextPeriod(nextPeriod(here));
  for (const p of [nextPeriod(here), here, previousPeriod(here)]) {
    const gap = Math.abs(daysBetween(receivedOn, expectedStart(p, settings)));
    if (gap < Math.abs(daysBetween(receivedOn, expectedStart(best, settings)))) best = p;
  }
  return best;
}
