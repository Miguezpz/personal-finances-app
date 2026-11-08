"use client";

/**
 * Credit timeline (T144, FR-028/029, US10-1): paydays, card due dates and collections from
 * debtors over the next weeks, so it's clear which pay covers which card. Card events headline the
 * "pay to avoid interest" amount — the minimum payment is never shown.
 */
import { CreditCard, HandCoins, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Money } from "@/components/money/Money";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { creditTimeline, type TimelineEvent } from "@/domain/credit";
import { addDays, daysBetween } from "@/domain/dates";
import type { Cents, IsoDate } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import { EmptyState } from "@/components/ui/empty-state";
import { navIcon } from "@/components/layout/nav-items";

export const TIMELINE_DAYS = 60;

const ICONS = { payday: Wallet, card_due: CreditCard, collection_due: HandCoins } as const;

export function useCreditTimeline(today: IsoDate): TimelineEvent[] | undefined {
  const { data } = useFinanceSnapshot();
  return useMemo(
    () => (data ? creditTimeline(data, today, addDays(today, TIMELINE_DAYS)) : undefined),
    [data, today],
  );
}

export function CreditTimeline({ events, today }: { events: TimelineEvent[]; today: IsoDate }) {
  const t = useTranslations("credit");
  const locale = usePreferences(selectLocale);

  const byDate = new Map<IsoDate, TimelineEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  if (events.length === 0) {
    return <EmptyState icon={navIcon("/credit")}>{t("timelineEmpty")}</EmptyState>;
  }

  return (
    <ol className="relative flex flex-col gap-5 border-l pl-6" data-testid="credit-timeline">
      {[...byDate].map(([date, dayEvents]) => {
        const days = daysBetween(today, date);
        return (
          <li key={date} className="relative flex flex-col gap-2">
            <span
              aria-hidden="true"
              className="absolute top-1 -left-[1.9rem] size-3 rounded-full border-2 border-background bg-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{formatDate(date, locale)}</span>
              {" · "}
              {days === 0 ? t("today") : t("inDays", { days })}
            </p>
            <ul className="flex flex-col gap-2">
              {dayEvents.map((e) => {
                const Icon = ICONS[e.kind];
                return (
                  <li
                    key={`${e.kind}:${e.refId ?? date}`}
                    data-testid="timeline-event"
                    data-kind={e.kind}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-lg border p-3",
                      e.kind === "card_due" &&
                        (e.amount ?? 0) > 0 &&
                        "border-primary/40 bg-muted/40",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">
                          {e.kind === "payday"
                            ? t("payday")
                            : e.kind === "card_due"
                              ? t("cardDue", { card: e.label })
                              : t("collectFrom", { name: e.label })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {e.kind === "payday"
                            ? t("paydayHint")
                            : e.kind === "card_due"
                              ? e.paid
                                ? t("statePaid")
                                : (e.amount ?? 0) > 0
                                  ? t("payToAvoidInterest")
                                  : t("nothingToPay")
                              : t("collectHint")}
                        </span>
                      </div>
                    </div>
                    {e.amount !== null && (e.kind !== "card_due" || e.amount > 0) && (
                      <Money
                        cents={e.amount as Cents}
                        className={cn(
                          "shrink-0 tabular-nums",
                          e.kind === "card_due" ? "text-lg font-semibold" : "font-medium",
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
