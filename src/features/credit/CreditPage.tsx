"use client";

/**
 * Credit management (T144, FR-028/029, US10-1/1a): each card's statement — the amount to pay to
 * avoid interest as the headline, its due date and the total debt (with the full MSI balance) —
 * and the timeline of paydays, due dates and collections.
 */
import { CalendarClock, CreditCard, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cents } from "@/domain/types";
import { useCardStatuses } from "@/features/expenses/CardDebtSummary";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { CreditTimeline, TIMELINE_DAYS, useCreditTimeline } from "./CreditTimeline";
import { PageHeader } from "@/components/layout/PageHeader";
import { navIcon } from "@/components/layout/nav-items";
import { EmptyState } from "@/components/ui/empty-state";

export function CreditPage() {
  const t = useTranslations("credit");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const cards = useCardStatuses();
  const events = useCreditTimeline(today);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader icon={navIcon("/credit")} title={t("title")} description={t("description")} />

      {!cards || !events ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-36" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          {cards.length === 0 ? (
            <EmptyState icon={navIcon("/credit")} className="p-6">
              {t.rich("noCards", {
                link: (chunks) => (
                  <Link
                    href="/settings/accounts"
                    className="font-medium underline underline-offset-4"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {cards.map(({ card, status }) => {
                // An overdue statement stays the headline until it's paid; otherwise show the
                // next one, exactly as the timeline does (the last one may be paid already).
                const next = events.find((e) => e.kind === "card_due" && e.refId === card.id);
                const statement =
                  status.overdue || !next
                    ? { due: status.nextPaymentDue, amount: status.payToAvoidInterest }
                    : { due: next.date, amount: (next.amount ?? 0) as Cents };
                return (
                  <li key={card.id}>
                    <Card data-testid="credit-card" data-card={card.id}>
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                          <CreditCard aria-hidden="true" className="size-4 text-muted-foreground" />
                          {card.name}
                          {status.overdue && (
                            <Badge variant="destructive">
                              <TriangleAlert aria-hidden="true" />
                              {t("overdue")}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5">
                          <CalendarClock aria-hidden="true" focusable="false" className="size-4" />
                          {t("statementDue", { date: formatDate(statement.due, locale) })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">
                            {t("payToAvoidInterest")}
                          </span>
                          <Money cents={statement.amount} className="text-3xl font-semibold" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t.rich("totalDebt", {
                            amount: () => <Money cents={status.totalDebt} />,
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <section aria-labelledby="timeline-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="timeline-title" className="text-lg font-semibold">
                {t("timelineTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("timelineHint", { days: TIMELINE_DAYS })}
              </p>
            </div>
            <CreditTimeline events={events} today={today} />
          </section>
        </>
      )}
    </section>
  );
}
