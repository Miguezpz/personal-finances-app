/**
 * Locale-aware formatting (T046). The ONLY module allowed to build currency formatters
 * (ESLint); every amount is rendered through <Money> / useMoneyFormatter, which call this.
 * Amounts arrive as integer cents of the display currency; dividing by 100 here is display-only.
 */
import { parseIsoDate } from "@/domain/dates";
import type { BasisPoints, Cents, DisplayCurrency, IsoDate, Locale } from "@/domain/types";
import { INTL_LOCALE } from "./config";

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: () => T): T {
  let f = cache.get(key) as T | undefined;
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

export interface MoneyFormatOptions {
  /** Always show the sign (+/−), e.g. for ledger movements. */
  signed?: boolean;
  /** Drop the cents when the amount is whole (compact chart axes). */
  compact?: boolean;
}

export function formatMoney(
  amount: Cents,
  currency: DisplayCurrency,
  locale: Locale,
  options: MoneyFormatOptions = {},
): string {
  const { signed = false, compact = false } = options;
  const f = cached(
    `money:${locale}:${currency}:${signed}:${compact}`,
    () =>
      new Intl.NumberFormat(INTL_LOCALE[locale], {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: compact ? 0 : 2,
        maximumFractionDigits: compact ? 0 : 2,
        signDisplay: signed ? "exceptZero" : "auto",
      }),
  );
  const text = f.format(amount / 100);
  // MXN, USD and EUR can share "$"; disambiguate non-MXN amounts with the ISO code.
  return currency === "MXN" || currency === "EUR" ? text : `${text} ${currency}`;
}

export type DateStyle = "short" | "medium" | "long";

export function formatDate(date: IsoDate, locale: Locale, style: DateStyle = "medium"): string {
  const { year, month, day } = parseIsoDate(date);
  const f = cached(
    `date:${locale}:${style}`,
    () =>
      new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        // Business dates have no time: format the calendar date in UTC so it never shifts.
        timeZone: "UTC",
        ...(style === "short" && { day: "numeric", month: "short" }),
        ...(style === "medium" && { day: "numeric", month: "short", year: "numeric" }),
        ...(style === "long" && {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      }),
  );
  return f.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatPercent(value: BasisPoints, locale: Locale): string {
  const f = cached(
    `pct:${locale}`,
    () =>
      new Intl.NumberFormat(INTL_LOCALE[locale], { style: "percent", maximumFractionDigits: 2 }),
  );
  return f.format(value / 10_000);
}
