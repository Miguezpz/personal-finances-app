"use client";

/**
 * Safe-to-Spend of one bucket (T074): available balance, semáforo, a progress bar against the base
 * and the full breakdown (carry, allocated, recurring applied/pending, expenses, goals).
 */
import { useTranslations } from "next-intl";
import { Money } from "@/components/money/Money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { negateCents } from "@/domain/money";
import type { BucketSafeToSpend } from "@/domain/safe-to-spend";
import type { Cents } from "@/domain/types";
import { cn } from "@/lib/utils";
import { LIGHT_STYLES, TrafficLightBadge } from "./TrafficLightBadge";

function Row({ label, cents, muted = false }: { label: string; cents: Cents; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", muted && "text-muted-foreground")}>
      <dt>{label}</dt>
      <dd>
        <Money cents={cents} signed />
      </dd>
    </div>
  );
}

export function BucketCard({ data }: { data: BucketSafeToSpend }) {
  const t = useTranslations("dashboard");
  const tb = useTranslations("buckets");
  const name = tb(data.bucket);
  // Share of the base still available, clamped for the bar (the badge carries the exact state).
  const percent =
    data.ratio === null ? 0 : Math.max(0, Math.min(100, Math.floor(data.ratio / 100)));

  return (
    <Card data-testid={`bucket-${data.bucket}`} data-light={data.light}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-base">{name}</CardTitle>
        <TrafficLightBadge light={data.light} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t("safeToSpend")}</span>
          <Money
            cents={data.available}
            className={cn(
              "text-3xl font-semibold tracking-tight",
              data.available < 0 && "text-red-700 dark:text-red-400",
            )}
          />
          {data.base > 0 && (
            <span className="text-sm text-muted-foreground">
              {t("ofBasePrefix")} <Money cents={data.base} />
            </span>
          )}
        </div>

        <div
          role="progressbar"
          aria-label={t("progressLabel", { bucket: name })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={t(`light.${data.light}`)}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              LIGHT_STYLES[data.light].bar,
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        <dl className="flex flex-col gap-1 text-sm">
          <Row label={t("carryIn")} cents={data.carryIn} muted={data.carryIn === 0} />
          <Row label={t("allocated")} cents={data.allocated} />
          <Row
            label={t("fixedApplied")}
            cents={negateCents(data.fixedApplied)}
            muted={data.fixedApplied === 0}
          />
          <Row
            label={t("fixedPending")}
            cents={negateCents(data.fixedPending)}
            muted={data.fixedPending === 0}
          />
          <Row label={t("manual")} cents={negateCents(data.manual)} muted={data.manual === 0} />
          <Row
            label={t("goalContributions")}
            cents={negateCents(data.goalContributions)}
            muted={data.goalContributions === 0}
          />
        </dl>
      </CardContent>
    </Card>
  );
}
