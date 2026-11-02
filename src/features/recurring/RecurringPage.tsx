"use client";

/**
 * Recurring expenses (T084, US3): list with charge day, bucket, status and next charge; create,
 * edit (future charges only), pause / resume and delete (applied charges stay in the history).
 */
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoReadOnlyError } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { maxIsoDate } from "@/domain/dates";
import { nextChargeDate } from "@/domain/recurring";
import type { FinanceSnapshot, RecurringExpense } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { useDeleteRecurring, usePauseRecurring, useRecurring, useResumeRecurring } from "./hooks";
import { RecurringForm } from "./RecurringForm";

const selectLookups = (s: FinanceSnapshot) => ({
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
  const remove = useDeleteRecurring();
  const [form, setForm] = useState<{ open: boolean; recurring: RecurringExpense | null }>({
    open: false,
    recurring: null,
  });
  const [toDelete, setToDelete] = useState<RecurringExpense | null>(null);

  const onError = (e: Error) => {
    if (!isDemoReadOnlyError(e)) toast.error(tc("unexpectedError"));
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

  function confirmDelete() {
    if (!toDelete) return;
    remove.mutate(toDelete.id, { onSuccess: () => toast.success(t("deleted")), onError });
    setToDelete(null);
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          onClick={() => setForm({ open: true, recurring: null })}
          data-testid="add-recurring"
        >
          <Plus aria-hidden="true" />
          {t("addTitle")}
        </Button>
      </header>

      {!recurring || !lookups ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sorted.map((r) => {
            const paused = isPaused(r);
            const next = paused ? null : nextChargeDate(r, today);
            const sub = lookups.subcategories.find((x) => x.id === r.subcategoryId);
            const account = lookups.accounts.find((a) => a.id === r.paymentAccountId);
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
                        <Badge variant="outline">{tb(r.bucket)}</Badge>
                        {paused && <Badge variant="secondary">{t("pausedBadge")}</Badge>}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {r.chargeDay >= 29
                          ? t("chargeDayLast", { day: r.chargeDay })
                          : t("chargeDayLabel", { day: r.chargeDay })}
                        {sub && <> · {nameOf(sub)}</>}
                        {account && <> · {account.name}</>}
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
                      <Button variant="ghost" size="sm" onClick={() => setToDelete(r)}>
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

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteHint")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
