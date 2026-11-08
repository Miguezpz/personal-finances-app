"use client";

/**
 * Safe-to-Spend of one bucket (T074): available balance, semáforo, a progress bar against the base
 * and the full breakdown (carry, allocated, recurring applied/pending, expenses, goals).
 *
 * Motion (spec 003, FR-030/031): when the available balance changes the block flashes its background (never the
 * figure, which always shows its final value); the bar grows from zero with a transform; the semáforo color fades.
 */
import { ChevronRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Money } from "@/components/money/Money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { negateCents } from "@/domain/money";
import type { RecurringStatusItem } from "@/domain/recurring";
import type { BucketSafeToSpend } from "@/domain/safe-to-spend";
import type { Cents } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import { LIGHT_STYLES, TrafficLightBadge } from "./TrafficLightBadge";
import { BUCKET_ICONS } from "@/components/icons/domain-icons";
import { useFlashOnChange } from "@/components/motion/use-flash-on-change";
import { useMountedFrame } from "@/components/motion/use-mounted-frame";

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

/** A recurring charge of the quincena: "pending" (dashed, clock) vs "charged" (solid, check). */
function RecurringRow({ item }: { item: RecurringStatusItem }) {
  const t = useTranslations("dashboard");
  const locale = usePreferences(selectLocale);
  const pending = item.status === "pending";
  return (
    <li
      data-status={item.status}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-sm",
        pending ? "border border-dashed text-muted-foreground" : "bg-muted/60",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {pending ? (
          <Clock aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
        )}
        <span className="truncate">{item.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(item.date, locale, "short")} ·{" "}
          {t(pending ? "statusPending" : "statusApplied")}
        </span>
      </span>
      <Money cents={item.amount} />
    </li>
  );
}

export function BucketCard({
  data,
  recurring = [],
}: {
  data: BucketSafeToSpend;
  recurring?: readonly RecurringStatusItem[];
}) {
  const t = useTranslations("dashboard");
  const tb = useTranslations("buckets");
  const name = tb(data.bucket);
  // Share of the base still available, clamped for the bar (the badge carries the exact state).
  const percent =
    data.ratio === null ? 0 : Math.max(0, Math.min(100, Math.floor(data.ratio / 100)));

  // Re-key the balance block when the balance changes, to replay the highlight (not on the first render).
  const { key: flashes, flashing } = useFlashOnChange(data.available);

  // The bar starts at 0 and grows to its value on the next frame.
  const mounted = useMountedFrame();

  return (
    <Card data-testid={`bucket-${data.bucket}`} data-light={data.light}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <BucketIcon bucket={data.bucket} />
          {name}
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Spec 009 (FR-024): straight to this bucket's expenses. */}
          <Link
            href={`/expenses?bucket=${data.bucket}`}
            className="inline-flex items-center gap-0.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11"
            data-testid={`bucket-${data.bucket}-link`}
          >
            {t("seeExpenses")}
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </Link>
          <TrafficLightBadge light={data.light} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          key={flashes}
          data-testid={`bucket-${data.bucket}-balance`}
          className={cn(
            "flex flex-col gap-1 rounded-lg bg-surface-highlight p-4",
            flashing && "animate-balance-highlight",
          )}
        >
          <span className="text-sm text-muted-foreground">{t("safeToSpend")}</span>
          <Money
            cents={data.available}
            className={cn(
              "text-[clamp(2rem,6vw,2.75rem)] leading-tight font-semibold tracking-tight",
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
              "h-full w-full origin-left rounded-full",
              "[transition:transform_var(--duration-slow)_var(--ease-out-quint),background-color_var(--duration-base)]",
              LIGHT_STYLES[data.light].bar,
            )}
            style={{ transform: `scaleX(${mounted ? percent / 100 : 0})` }}
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

        {recurring.length > 0 && (
          <section aria-label={t("recurringTitle")} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("recurringTitle")}</h3>
            <ul className="flex flex-col gap-1" data-testid={`recurring-${data.bucket}`}>
              {recurring.map((item) => (
                <RecurringRow key={`${item.recurringExpenseId}-${item.date}`} item={item} />
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function BucketIcon({ bucket }: { bucket: keyof typeof BUCKET_ICONS }) {
  const Icon = BUCKET_ICONS[bucket];
  return <Icon aria-hidden="true" focusable="false" className="size-4 shrink-0" />;
}
