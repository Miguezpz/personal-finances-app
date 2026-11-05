"use client";

/**
 * In-app collection alerts (T101, FR-025): overdue collections and those due in the next 7 days
 * (fixed window), computed when the app opens — no push, email or server job (Principle I).
 */
import { CalendarClock, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";
import { Money } from "@/components/money/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { COLLECTION_ALERT_WINDOW_DAYS, collectionAlerts } from "@/domain/installments";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import { useReceivables } from "./hooks";

const MAX_SHOWN = 5;

export function CollectionAlerts() {
  const t = useTranslations("receivables");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const { data } = useReceivables();

  const alerts = useMemo(
    () =>
      data
        ? collectionAlerts(data.installments, data.receivables, today, COLLECTION_ALERT_WINDOW_DAYS)
        : [],
    [data, today],
  );
  if (!data || alerts.length === 0) return null;

  const debtorName = (id: string) => data.debtors.find((d) => d.id === id)?.name ?? "";
  const when = (days: number) =>
    days < 0 ? t("overdueBy", { days: -days }) : days === 0 ? t("dueToday") : t("dueIn", { days });

  return (
    <Alert data-testid="collection-alerts">
      <HandCoins aria-hidden="true" />
      <AlertTitle>{t("alertsTitle", { count: alerts.length })}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <ul className="flex w-full flex-col gap-1">
          {alerts.slice(0, MAX_SHOWN).map((a) => (
            <li
              key={a.installmentId}
              className="flex flex-wrap items-center justify-between gap-x-4 text-sm"
            >
              <span>
                <span className="font-medium text-foreground">{debtorName(a.debtorId)}</span> ·{" "}
                <CalendarClock
                  aria-hidden="true"
                  focusable="false"
                  className="inline size-3.5 align-[-0.125em]"
                />{" "}
                {formatDate(a.dueOn, locale, "short")} ·{" "}
                <span className={cn(a.daysUntilDue < 0 && "font-medium text-destructive")}>
                  {when(a.daysUntilDue)}
                </span>
              </span>
              <Money cents={a.amountDue} className="font-medium text-foreground" />
            </li>
          ))}
        </ul>
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link href="/receivables">{t("goToReceivables")}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
