"use client";

/**
 * Net worth (T146, FR-031, US10-4): today's assets, liabilities and net worth (computed live from
 * the snapshot) and their monthly history. Amounts follow the display currency and privacy mode.
 */
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Money } from "@/components/money/Money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { computeNetWorth } from "@/domain/net-worth";
import { useToday } from "@/lib/use-today";
import { NetWorthChart } from "./NetWorthChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { navIcon } from "@/components/layout/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { PageLoadError } from "@/components/data/PageQueryState";
import { useSnapshotStatus } from "@/data/useFinanceSnapshot";
import { FlashOnChange } from "@/components/motion/FlashOnChange";

export function NetWorthPage() {
  const t = useTranslations("netWorth");
  const snapshotStatus = useSnapshotStatus();
  const today = useToday();
  const { data } = useFinanceSnapshot();
  const now = useMemo(() => (data ? computeNetWorth(data, today) : undefined), [data, today]);

  const tiles = now && [
    {
      key: "netWorth",
      label: t("series.netWorth"),
      value: now.netWorth,
      primary: true,
      icon: Scale,
    },
    {
      key: "assets",
      label: t("series.assets"),
      value: now.assets,
      primary: false,
      icon: ArrowUpRight,
    },
    {
      key: "liabilities",
      label: t("series.liabilities"),
      value: now.liabilities,
      primary: false,
      icon: ArrowDownRight,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader icon={navIcon("/net-worth")} title={t("title")} description={t("description")} />

      {snapshotStatus.isError ? (
        <PageLoadError onRetry={snapshotStatus.refetch} />
      ) : !data || !tiles ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3" data-testid="net-worth-now">
            {tiles.map((tile) => (
              <FlashOnChange
                key={tile.key}
                value={tile.value}
                className="flex flex-col gap-1 rounded-xl border p-4"
                data-testid="net-worth-tile"
              >
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <tile.icon aria-hidden="true" focusable="false" className="size-4 shrink-0" />
                  {tile.label}
                </dt>
                <dd>
                  <Money
                    cents={tile.value}
                    className={tile.primary ? "text-3xl font-semibold" : "text-xl font-semibold"}
                  />
                </dd>
              </FlashOnChange>
            ))}
          </dl>
          <p className="-mt-3 text-xs text-muted-foreground">{t("formulaHint")}</p>

          <Card>
            <CardHeader>
              <CardTitle>{t("historyTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.netWorthSnapshots.length === 0 ? (
                <EmptyState icon={navIcon("/net-worth")} className="border-0">
                  {t("noHistory")}
                </EmptyState>
              ) : (
                <NetWorthChart snapshots={data.netWorthSnapshots} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
