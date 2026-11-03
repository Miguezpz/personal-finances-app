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

export function NetWorthPage() {
  const t = useTranslations("netWorth");
  const today = useToday();
  const { data } = useFinanceSnapshot();
  const now = useMemo(() => (data ? computeNetWorth(data, today) : undefined), [data, today]);

  const tiles = now && [
    { key: "netWorth", label: t("series.netWorth"), value: now.netWorth, primary: true },
    { key: "assets", label: t("series.assets"), value: now.assets, primary: false },
    { key: "liabilities", label: t("series.liabilities"), value: now.liabilities, primary: false },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {!data || !tiles ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3" data-testid="net-worth-now">
            {tiles.map((tile) => (
              <div key={tile.key} className="flex flex-col gap-1 rounded-xl border p-4">
                <dt className="text-sm text-muted-foreground">{tile.label}</dt>
                <dd>
                  <Money
                    cents={tile.value}
                    className={tile.primary ? "text-3xl font-semibold" : "text-xl font-semibold"}
                  />
                </dd>
              </div>
            ))}
          </dl>
          <p className="-mt-3 text-xs text-muted-foreground">{t("formulaHint")}</p>

          <Card>
            <CardHeader>
              <CardTitle>{t("historyTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.netWorthSnapshots.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t("noHistory")}</p>
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
