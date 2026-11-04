"use client";

/**
 * Dashboard (T075): "how much can I spend today?" — Needs and Wants of the current quincena with
 * their semáforo, the quincena dates and the days to the next payday. Loading, empty and error
 * states; a clear warning when a bucket is overspent that never blocks recording (FR-021).
 */
import { Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddExpenseDialog } from "@/features/expenses/AddExpenseDialog";
import { formatPeriodRange } from "@/features/income/format";
import { CollectionAlerts } from "@/features/receivables/CollectionAlerts";
import { selectLocale, usePreferences } from "@/store/preferences";
import { BucketCard } from "./BucketCard";
import { useSafeToSpend } from "./useSafeToSpend";

export function Dashboard() {
  const t = useTranslations("dashboard");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const { data, recurringItems, hasAllocations, isPending, isError, refetch } = useSafeToSpend();
  const [adding, setAdding] = useState(false);

  const overspent = data ? [data.needs, data.wants].filter((b) => b.available < 0) : [];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          {data && (
            <p className="text-sm text-muted-foreground" data-testid="period-info">
              {t("period", formatPeriodRange(data.period.start, locale))} ·{" "}
              {data.daysUntilPayday === 0
                ? t("paydayToday")
                : t("paydayIn", { days: data.daysUntilPayday })}
            </p>
          )}
        </div>
        <Button
          variant="cta"
          onClick={() => setAdding(true)}
          disabled={!data}
          data-testid="add-expense"
        >
          <Plus aria-hidden="true" />
          {t("addExpense")}
        </Button>
      </header>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : isError || !data ? (
        <Alert variant="destructive">
          <AlertTitle>{tc("unexpectedError")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {t("loadError")}
            <Button variant="outline" size="sm" onClick={refetch}>
              {tc("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!hasAllocations && (
            <Alert>
              <AlertTitle>{t("emptyTitle")}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {t("emptyHint")}
                <Button asChild size="sm" variant="outline">
                  <Link href="/income">{t("registerIncome")}</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <CollectionAlerts />

          {overspent.length > 0 && (
            <Alert variant="destructive" role="status">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{t("overspentTitle")}</AlertTitle>
              <AlertDescription>
                {t("overspentHint", { buckets: overspent.map((b) => tb(b.bucket)).join(", ") })}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2" aria-live="polite">
            <BucketCard
              data={data.needs}
              recurring={recurringItems.filter((i) => i.bucket === "needs")}
            />
            <BucketCard
              data={data.wants}
              recurring={recurringItems.filter((i) => i.bucket === "wants")}
            />
          </div>
        </>
      )}

      {adding && <AddExpenseDialog open={adding} onOpenChange={setAdding} />}
    </section>
  );
}
