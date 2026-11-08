"use client";

/**
 * Credit management (T144, FR-028/029, US10-1/1a): the monthly payment session (spec 011, US5),
 * each card's last and next statements with "Ya la pagué" (spec 008, US3: the same
 * CardStatementCard as Expenses) and the timeline of paydays, due dates and collections.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/lib/use-today";
import { CardStatementCard } from "./CardStatementCard";
import { CreditTimeline, TIMELINE_DAYS, useCreditTimeline } from "./CreditTimeline";
import { PaymentSessionCard } from "./PaymentSessionCard";
import { useCardStatements } from "./use-card-statements";
import { PageHeader } from "@/components/layout/PageHeader";
import { navIcon } from "@/components/layout/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoadError } from "@/components/data/PageQueryState";
import { useSnapshotStatus } from "@/data/useFinanceSnapshot";

export function CreditPage() {
  const t = useTranslations("credit");
  const snapshotStatus = useSnapshotStatus();
  const today = useToday();
  const cards = useCardStatements();
  const events = useCreditTimeline(today);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader icon={navIcon("/credit")} title={t("title")} description={t("description")} />

      {snapshotStatus.isError ? (
        <PageLoadError onRetry={snapshotStatus.refetch} />
      ) : !cards || !events ? (
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
            <>
              <PaymentSessionCard />
              <ul className="grid gap-4 md:grid-cols-2">
                {cards.map((statement) => (
                  <li key={statement.card.id}>
                    <CardStatementCard statement={statement} variant="full" />
                  </li>
                ))}
              </ul>
            </>
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
