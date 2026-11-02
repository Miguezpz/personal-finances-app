"use client";

/**
 * PLACEHOLDER so the shell has a landing route; replaced by the real Safe-to-Spend dashboard
 * in T075 (US2). Shows the snapshot loading state end to end (cold start, errors, retry).
 */
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";

export default function DashboardPage() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const snapshot = useFinanceSnapshot();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard")}</h1>
      {snapshot.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : snapshot.isError ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p>{tc("unexpectedError")}</p>
          <Button variant="outline" onClick={() => void snapshot.refetch()}>
            {tc("retry")}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground">{tc("comingSoon")}</p>
      )}
    </section>
  );
}
