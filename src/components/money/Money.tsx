"use client";

/**
 * <Money> — the ONLY place amounts are rendered (T049, Principle V). Masks with "••••" when
 * privacy mode is on, or before preferences are hydrated while the data is real (safe default:
 * no flash of amounts). Charts use `useMoneyFormatter` so axes and tooltips mask the same way.
 *
 * Currency conversion for display (USD/EUR) is added by T109; until then amounts render in MXN.
 */
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useCanWrite } from "@/data/context";
import type { Cents, DisplayCurrency } from "@/domain/types";
import { formatMoney, type MoneyFormatOptions } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, selectShouldMask, usePreferences } from "@/store/preferences";

export const MASK = "••••";

export interface MoneyProps {
  cents: Cents;
  currency?: DisplayCurrency;
  signed?: boolean;
  className?: string;
}

/** true when amounts must be hidden right now. */
export function useShouldMask(): boolean {
  const holdsRealData = useCanWrite();
  return usePreferences((s) => selectShouldMask(s, holdsRealData));
}

/** Formatter for charts and other non-JSX contexts; returns "••••" when masked. */
export function useMoneyFormatter(): (cents: Cents, options?: MoneyFormatOptions) => string {
  const masked = useShouldMask();
  const locale = usePreferences(selectLocale);
  return useCallback(
    (cents, options) => (masked ? MASK : formatMoney(cents, "MXN", locale, options)),
    [masked, locale],
  );
}

export function Money({ cents, currency = "MXN", signed = false, className }: MoneyProps) {
  const t = useTranslations("common");
  const masked = useShouldMask();
  const locale = usePreferences(selectLocale);

  if (masked) {
    return (
      <span className={cn("money tabular-nums", className)} data-masked="true">
        <span aria-hidden="true">{MASK}</span>
        <span className="sr-only">{t("hiddenAmount")}</span>
      </span>
    );
  }
  return (
    <span className={cn("money tabular-nums", className)} data-masked="false">
      {formatMoney(cents, currency, locale, { signed })}
    </span>
  );
}
