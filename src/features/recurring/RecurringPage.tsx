"use client";

/**
 * Recurring expenses (T084, US3): list with charge day, bucket, status and next charge; create,
 * edit (future charges only), pause / resume and delete (applied charges stay in the history).
 */
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { AccountMark } from "@/components/icons/AccountMark";
import { BUCKET_ICONS } from "@/components/icons/domain-icons";
import { navIcon } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/PageHeader";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { maxIsoDate } from "@/domain/dates";
import { taxonomyIconFor } from "@/domain/icons";
import { nextChargeDate } from "@/domain/recurring";
import type { FinanceSnapshot, RecurringExpense } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { usePauseRecurring, useRecurring, useResumeRecurring } from "./hooks";
import { useDeferredDelete } from "@/features/shared/use-deferred-delete";
import { RecurringForm } from "./RecurringForm";

const selectLookups = (s: FinanceSnapshot) => ({
  categories: s.categories,
  subcategories: s.subcategories,
  accounts: s.accounts,
});

export function RecurringPage() {
  const t = useTranslations("recurring");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const nameOf = useTaxonomyName();
  const { data: recurring } = useRecurring();
  const { data: lookups } = useFinanceSnapshot(selectLookups);
  const pause = usePauseRecurring();
  const resume = useResumeRecurring();
  const { remove } = useDeferredDelete();
  const [form, setForm] = useState<{ open: boolean; recurring: RecurringExpense | null }>({
    open: false,
    recurring: null,
  });

  const onError = (e: Error) => {
    if (!isNotifiedGlobally(e)) toast.error(tc("unexpectedError"));
  };
  const isPaused = (r: RecurringExpense) => r.endedOn !== null;
  const sorted = [...(recurring ?? [])].sort((a, b) =>
    isPaused(a) === isPaused(b) ? a.chargeDay - b.chargeDay : isPaused(a) ? 1 : -1,
  );

  function togglePause(r: RecurringExpense) {
    if (r.endedOn === null) {
      // The DB requires ended_on ≥ starts_on (a not-yet-started item pauses at its start).
      pause.mutate(
        { id: r.id, endedOn: maxIsoDate(today, r.startsOn) },
        { onSuccess: () => toast.success(t("paused")), onError },
      );
    } else {
      resume.mutate({ id: r.id, today }, { onSuccess: () => toast.success(t("resumed")), onError });
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        icon={navIcon("/recurring")}
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            onClick={() => setForm({ open: true, recurring: null })}
            data-testid="add-recurring"
          >
            <Plus aria-hidden="true" />
            {t("addTitle")}
          </Button>
        }
      />

      {!recurring || !lookups ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={navIcon("/recurring")}>{t("empty")}</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((r) => {
            const paused = isPaused(r);
            const next = paused ? null : nextChargeDate(r, today);
            const sub = lookups.subcategories.find((x) => x.id === r.subcategoryId);
            const account = lookups.accounts.find((a) => a.id === r.paymentAccountId);
            const BucketIcon = BUCKET_ICONS[r.bucket];
            return (
              <li key={r.id}>
                <Card
                  data-testid="recurring-card"
                  data-status={paused ? "paused" : "active"}
                  className={paused ? "opacity-70" : undefined}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <span className="truncate">{r.name}</span>
                        <Badge variant="outline">
                          <BucketIcon aria-hidden="true" focusable="false" />
                          {tb(r.bucket)}
                        </Badge>
                        {paused && (
                          <Badge variant="secondary">
                            <Pause aria-hidden="true" focusable="false" />
                            {t("pausedBadge")}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                        {r.chargeDay >= 29
                          ? t("chargeDayLast", { day: r.chargeDay })
                          : t("chargeDayLabel", { day: r.chargeDay })}
                        {sub && (
                          <span className="inline-flex items-center gap-1">
                            {" "}
                            · <CategoryIcon icon={taxonomyIconFor(sub.id, lookups)} />
                            {nameOf(sub)}
                          </span>
                        )}
                        {account && (
                          <span className="inline-flex items-center gap-1">
                            {" "}
                            · <AccountMark account={account} />
                            {account.name}
                          </span>
                        )}
                      </p>
                    </div>
                    <Money cents={r.amount} className="text-lg font-semibold" />
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm">
                      <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
                      {paused
                        ? t("pausedSince", {
                            date: formatDate(r.endedOn as RecurringExpense["startsOn"], locale),
                          })
                        : next
                          ? t("nextCharge", { date: formatDate(next, locale) })
                          : t("noNextCharge")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setForm({ open: true, recurring: r })}
                        data-testid="edit-recurring"
                      >
                        <Pencil aria-hidden="true" />
                        {t("edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePause(r)}
                        data-testid="toggle-recurring"
                      >
                        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                        {paused ? t("resume") : t("pause")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          remove({
                            kind: "recurring",
                            id: r.id,
                            label: tc("deletedItem", { name: r.name }),
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                        {t("delete")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {form.open && (
        <RecurringForm
          key={form.recurring?.id ?? "new"}
          open={form.open}
          recurring={form.recurring}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        />
      )}
    </section>
  );
}
