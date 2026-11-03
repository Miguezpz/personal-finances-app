"use client";

/**
 * <Money> — the ONLY place amounts are rendered (T049, Principle V).
 *  - Converts MXN cents to the display currency for PRESENTATION only (T109, FR-034); the data
 *    stays in MXN. Without a usable rate it shows MXN (FxStatus explains why, FR-036).
 *  - Masks with "••••" when privacy mode is on, or before preferences are hydrated while the data
 *    is real (safe default: no flash of amounts).
 * Charts use `useMoneyFormatter`, so axes and tooltips convert and mask the same way.
 */
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useCanWrite } from "@/data/context";
import { convert } from "@/domain/fx";
import type { Cents, DisplayCurrency, FxSnapshot } from "@/domain/types";
import { useFxRates } from "@/features/fx/useFxRates";
import { formatMoney, type MoneyFormatOptions } from "@/i18n/format";
import { cn } from "@/lib/utils";
import {
  selectDisplayCurrency,
  selectLocale,
  selectShouldMask,
  usePreferences,
} from "@/store/preferences";

export const MASK = "••••";

export interface MoneyProps {
  /** Always MXN cents (the source of truth). */
  cents: Cents;
  /** Overrides the display currency chosen by the user. */
  currency?: DisplayCurrency;
  signed?: boolean;
  className?: string;
}

/** true when amounts must be hidden right now. */
export function useShouldMask(): boolean {
  const holdsRealData = useCanWrite();
  return usePreferences((s) => selectShouldMask(s, holdsRealData));
}

/** The currency amounts are actually shown in: the chosen one if a rate exists, else MXN. */
export function effectiveCurrency(wanted: DisplayCurrency, fx: FxSnapshot | null): DisplayCurrency {
  return wanted !== "MXN" && fx ? wanted : "MXN";
}

export function useDisplayCurrency(): { currency: DisplayCurrency; fx: FxSnapshot | null } {
  const wanted = usePreferences(selectDisplayCurrency);
  const { fx } = useFxRates();
  return { currency: effectiveCurrency(wanted, fx), fx };
}

/** Formatter for charts and other non-JSX contexts; returns "••••" when masked. */
export function useMoneyFormatter(): (cents: Cents, options?: MoneyFormatOptions) => string {
  const masked = useShouldMask();
  const locale = usePreferences(selectLocale);
  const { currency, fx } = useDisplayCurrency();
  return useCallback(
    (cents, options) =>
      masked ? MASK : formatMoney(convert(cents, currency, fx), currency, locale, options),
    [masked, locale, currency, fx],
  );
}

export function Money({ cents, currency: override, signed = false, className }: MoneyProps) {
  const t = useTranslations("common");
  const masked = useShouldMask();
  const locale = usePreferences(selectLocale);
  const display = useDisplayCurrency();
  const currency = override ? effectiveCurrency(override, display.fx) : display.currency;

  if (masked) {
    return (
      <span className={cn("money tabular-nums", className)} data-masked="true">
        <span aria-hidden="true">{MASK}</span>
        <span className="sr-only">{t("hiddenAmount")}</span>
      </span>
    );
  }
  return (
    <span
      className={cn("money tabular-nums", className)}
      data-masked="false"
      data-currency={currency}
    >
      {formatMoney(convert(cents, currency, display.fx), currency, locale, { signed })}
    </span>
  );
}
