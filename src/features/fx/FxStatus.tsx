"use client";

/**
 * Which exchange rate is in use (T110, FR-035/036). Only shown while a foreign display currency is
 * selected: the rate ("1 USD = 18.72 MXN"), its publication date and source, and when it was
 * fetched. If the rate is old or missing it says so, offers a retry, and amounts stay in MXN.
 */
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatRate } from "@/i18n/format";
import { useTimezone } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { selectDisplayCurrency, selectLocale, usePreferences } from "@/store/preferences";
import { useFxRates } from "./useFxRates";

export function FxStatus() {
  const t = useTranslations("fx");
  const wanted = usePreferences(selectDisplayCurrency);
  const locale = usePreferences(selectLocale);
  const timezone = useTimezone();
  const { fx, isLoading, isFetching, retry } = useFxRates();

  if (wanted === "MXN") return null;

  const retryButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void retry()}
      disabled={isFetching}
      data-testid="fx-retry"
    >
      <RefreshCw aria-hidden="true" className={cn(isFetching && "animate-spin")} />
      {t("retry")}
    </Button>
  );

  let content: React.ReactNode;
  let state: "loading" | "ok" | "stale" | "unavailable";
  if (isLoading) {
    state = "loading";
    content = t("loading");
  } else if (!fx) {
    state = "unavailable";
    content = (
      <>
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
        <span>{t("unavailable", { currency: wanted })}</span>
        {retryButton}
      </>
    );
  } else {
    state = fx.stale ? "stale" : "ok";
    const rate = formatRate(1 / fx.rates[wanted], locale);
    content = (
      <>
        {fx.stale && (
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
        )}
        <span>
          <span className="font-medium text-foreground">
            {t("rate", { currency: wanted, rate })}
          </span>
          {" · "}
          {t("rateOf", { date: formatDate(fx.asOf, locale), source: fx.source })}
          {" · "}
          {t(fx.stale ? "staleSince" : "fetchedAt", {
            time: formatDateTime(fx.fetchedAt, locale, timezone),
          })}
        </span>
        {fx.stale && retryButton}
      </>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="fx-status"
      data-state={state}
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-1.5 text-xs text-muted-foreground",
        (state === "stale" || state === "unavailable") && "bg-amber-50 dark:bg-amber-950/40",
      )}
    >
      {content}
    </div>
  );
}
