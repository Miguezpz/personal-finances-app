"use client";

/**
 * Goals (T145, FR-030, US10-2/3): the emergency fund measured in months of vital expenses, and
 * sinking funds that hold back a monthly amount from their source bucket. Contributions from
 * Needs/Wants lower that bucket's Safe-to-Spend; from Investment they don't.
 */
import { Archive, ArchiveRestore, LifeBuoy, Pencil, PiggyBank, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotifiedGlobally } from "@/data/errors";
import { parseIsoDate } from "@/domain/dates";
import { emergencyFundProgress } from "@/domain/goals";
import type { Cents, Goal, GoalContribution } from "@/domain/types";
import { formatNumber } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { GoalForm } from "./GoalForm";
import { useGoalData, useUpdateGoal } from "./hooks";

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function GoalsPage() {
  const t = useTranslations("goals");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const { data } = useGoalData();
  const update = useUpdateGoal();
  const [form, setForm] = useState<{ open: boolean; goal: Goal | null }>({
    open: false,
    goal: null,
  });

  const onError = (e: Error) => {
    if (!isNotifiedGlobally(e)) toast.error(tc("unexpectedError"));
  };
  const toggleArchived = (g: Goal) =>
    update.mutate(
      { id: g.id, patch: { archived: !g.archived } },
      { onSuccess: () => toast.success(g.archived ? t("restored") : t("archived")), onError },
    );

  const year = parseIsoDate(today).year;
  const savedThisYear = (g: Goal, contributions: readonly GoalContribution[]) =>
    contributions
      .filter((c) => c.goalId === g.id && parseIsoDate(c.periodStart).year === year)
      .reduce((s, c) => s + c.amount, 0) as Cents;
  const byStatus = (a: Goal, b: Goal) =>
    Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name);

  const actions = (g: Goal) => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setForm({ open: true, goal: g })}>
        <Pencil aria-hidden="true" />
        {t("edit")}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => toggleArchived(g)}>
        {g.archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {g.archived ? t("restore") : t("archive")}
      </Button>
    </div>
  );

  const contributionLine = (g: Goal) =>
    g.monthly !== null && (
      <p className="text-sm text-muted-foreground">
        {t.rich("monthlyFrom", {
          amount: () => <Money cents={g.monthly as Cents} />,
          bucket: tb(g.sourceBucket),
        })}
      </p>
    );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          variant="cta"
          onClick={() => setForm({ open: true, goal: null })}
          data-testid="add-goal"
        >
          <Plus aria-hidden="true" />
          {t("addTitle")}
        </Button>
      </header>

      {!data ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : data.goals.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.goals
            .filter((g) => g.kind === "emergency_fund")
            .sort(byStatus)
            .map((g) => {
              const p = emergencyFundProgress(g, data.contributions, data.expenses, today);
              return (
                <li key={g.id}>
                  <Card
                    data-testid="goal-card"
                    data-kind={g.kind}
                    className={g.archived ? "opacity-70" : undefined}
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <LifeBuoy aria-hidden="true" className="size-4 text-muted-foreground" />
                        {g.name}
                        <Badge variant="outline">{t("kinds.emergency_fund")}</Badge>
                        {g.archived && <Badge variant="secondary">{t("archivedBadge")}</Badge>}
                      </CardTitle>
                      <CardDescription>
                        {p.vitalMonthly > 0
                          ? t.rich("vitalExpenses", {
                              amount: () => <Money cents={p.vitalMonthly} />,
                            })
                          : t("noVitalHistory")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <Money cents={p.saved} className="text-2xl font-semibold" />
                        {p.target > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {t.rich("ofTarget", { amount: () => <Money cents={p.target} /> })}
                          </span>
                        )}
                      </div>
                      <ProgressBar
                        value={p.target > 0 ? p.saved / p.target : 0}
                        label={t("progressLabel", { name: g.name })}
                      />
                      <p className="text-sm font-medium" data-testid="months-covered">
                        {t("monthsCovered", {
                          covered: formatNumber(p.monthsCovered, locale),
                          target: g.targetMonths ?? 0,
                        })}
                      </p>
                      {contributionLine(g)}
                      {actions(g)}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          {data.goals
            .filter((g) => g.kind === "sinking_fund")
            .sort(byStatus)
            .map((g) => {
              const saved = savedThisYear(g, data.contributions);
              const annual = g.annual ?? (0 as Cents);
              return (
                <li key={g.id}>
                  <Card
                    data-testid="goal-card"
                    data-kind={g.kind}
                    className={g.archived ? "opacity-70" : undefined}
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <PiggyBank aria-hidden="true" className="size-4 text-muted-foreground" />
                        {g.name}
                        <Badge variant="outline">{t("kinds.sinking_fund")}</Badge>
                        {g.archived && <Badge variant="secondary">{t("archivedBadge")}</Badge>}
                      </CardTitle>
                      <CardDescription>
                        {t.rich("annualTarget", { amount: () => <Money cents={annual} /> })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <Money cents={saved} className="text-2xl font-semibold" />
                        <span className="text-sm text-muted-foreground">
                          {t("savedThisYear", { year: String(year) })}
                        </span>
                      </div>
                      <ProgressBar
                        value={annual > 0 ? saved / annual : 0}
                        label={t("progressLabel", { name: g.name })}
                      />
                      {contributionLine(g)}
                      {actions(g)}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
        </ul>
      )}

      {form.open && (
        <GoalForm
          key={form.goal?.id ?? "new"}
          open={form.open}
          goal={form.goal}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        />
      )}
    </section>
  );
}
