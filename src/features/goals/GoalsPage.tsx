"use client";

/**
 * Goals (T145, FR-030, US10-2/3): the emergency fund measured in months of vital expenses, and
 * sinking funds that hold back a monthly amount from their source bucket. Contributions from
 * Needs/Wants lower that bucket's Safe-to-Spend; from Investment they don't.
 * Spec 014: purchases funded from Saved; any goal can receive Saved (Assign, only with the
 * save-surplus setting on) and give it back (Return, while not completed). "I bought it" archives
 * a purchase as completed.
 */
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleCheck,
  LifeBuoy,
  Pencil,
  PiggyBank,
  Plus,
  ShoppingBag,
} from "lucide-react";
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
import {
  availableToAssign,
  emergencyFundProgress,
  netFromSaved,
  purchaseProgress,
} from "@/domain/goals";
import type { Cents, Goal, GoalContribution } from "@/domain/types";
import { formatMonth, formatNumber } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { GoalForm } from "./GoalForm";
import { useGoalData, useUpdateGoal } from "./hooks";
import { SavedMoveDialog } from "./SavedMoveDialog";
import { useSafeToSpend } from "@/features/safe-to-spend/useSafeToSpend";
import { PageHeader } from "@/components/layout/PageHeader";
import { navIcon } from "@/components/layout/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { GOAL_KIND_ICONS } from "@/components/icons/domain-icons";
import { PageLoadError } from "@/components/data/PageQueryState";
import { useSnapshotStatus } from "@/data/useFinanceSnapshot";
import { FlashOnChange } from "@/components/motion/FlashOnChange";
import { useMountedFrame } from "@/components/motion/use-mounted-frame";

/** Grows from 0 to its value when it appears, like the buckets' bar (spec 010, FR-008). */
function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const mounted = useMountedFrame();
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-slow ease-out-quint"
        style={{ transform: `scaleX(${mounted ? pct / 100 : 0})` }}
        data-testid="goal-progress-fill"
      />
    </div>
  );
}

export function GoalsPage() {
  const t = useTranslations("goals");
  const snapshotStatus = useSnapshotStatus();
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
  const [move, setMove] = useState<{ mode: "assign" | "return"; goal: Goal; max: Cents } | null>(
    null,
  );
  // Assign only exists with the save-surplus setting on (spec 013 card visible).
  const saved = useSafeToSpend().data?.saved ?? null;
  const moves = data?.savedMoves ?? [];
  const assignable = saved
    ? (Math.max(availableToAssign(saved.total, moves).available, 0) as Cents)
    : null;

  const onError = (e: Error) => {
    if (!isNotifiedGlobally(e)) toast.error(tc("unexpectedError"));
  };
  // Restoring a completed purchase reopens it too (spec 014, US4-4).
  const toggleArchived = (g: Goal) =>
    update.mutate(
      { id: g.id, patch: g.archived ? { archived: false, completed: false } : { archived: true } },
      { onSuccess: () => toast.success(g.archived ? t("restored") : t("archived")), onError },
    );
  const markBought = (g: Goal) =>
    update.mutate(
      { id: g.id, patch: { archived: true, completed: true } },
      { onSuccess: () => toast.success(t("markedBought")), onError },
    );

  const year = parseIsoDate(today).year;
  const savedThisYear = (g: Goal, contributions: readonly GoalContribution[]) =>
    contributions
      .filter((c) => c.goalId === g.id && parseIsoDate(c.periodStart).year === year)
      .reduce((s, c) => s + c.amount, 0) as Cents;
  const byStatus = (a: Goal, b: Goal) =>
    Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name);

  const actions = (g: Goal) => {
    const net = netFromSaved(g.id, moves);
    return (
      <div className="flex flex-wrap gap-2">
        {assignable !== null && !g.archived && (
          <Button
            variant="outline"
            size="sm"
            disabled={assignable <= 0}
            onClick={() => setMove({ mode: "assign", goal: g, max: assignable })}
            data-testid="goal-assign"
          >
            <ArrowDownToLine aria-hidden="true" />
            {t("assign")}
          </Button>
        )}
        {!g.completed && net > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMove({ mode: "return", goal: g, max: net })}
            data-testid="goal-return"
          >
            <ArrowUpFromLine aria-hidden="true" />
            {t("returnToSaved")}
          </Button>
        )}
        {g.kind === "purchase" && !g.archived && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markBought(g)}
            data-testid="goal-bought"
          >
            <CircleCheck aria-hidden="true" />
            {t("bought")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setForm({ open: true, goal: g })}>
          <Pencil aria-hidden="true" />
          {t("edit")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toggleArchived(g)}>
          {g.archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
          {g.archived ? t("restore") : t("archive")}
        </Button>
      </div>
    );
  };

  const statusBadge = (g: Goal) =>
    g.completed ? (
      <Badge variant="secondary" data-testid="goal-completed">
        {t("completedBadge")}
      </Badge>
    ) : (
      g.archived && <Badge variant="secondary">{t("archivedBadge")}</Badge>
    );

  /** The part of a fund's progress that came from Saved (spec 014, US5). */
  const fromSavedLine = (g: Goal) => {
    const net = netFromSaved(g.id, moves);
    return (
      net > 0 && (
        <p className="text-sm text-muted-foreground">
          {t.rich("fromSaved", { amount: () => <Money cents={net} /> })}
        </p>
      )
    );
  };

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
      <PageHeader
        icon={navIcon("/goals")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setForm({ open: true, goal: null })}
              data-testid="add-goal"
            >
              <Plus aria-hidden="true" />
              {t("addTitle")}
            </Button>
          </>
        }
      />

      {snapshotStatus.isError ? (
        <PageLoadError onRetry={snapshotStatus.refetch} />
      ) : !data ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : data.goals.length === 0 ? (
        <EmptyState icon={navIcon("/goals")}>{t("empty")}</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.goals
            .filter((g) => g.kind === "emergency_fund")
            .sort(byStatus)
            .map((g) => {
              const p = emergencyFundProgress(
                g,
                data.contributions,
                data.expenses,
                today,
                data.savedMoves,
              );
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
                        <Badge variant="outline">
                          <GOAL_KIND_ICONS.emergency_fund aria-hidden="true" focusable="false" />
                          {t("kinds.emergency_fund")}
                        </Badge>
                        {statusBadge(g)}
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
                      <FlashOnChange
                        value={p.saved}
                        className="-mx-2 flex items-baseline justify-between gap-2 rounded-lg px-2 py-1"
                      >
                        <Money cents={p.saved} className="text-2xl font-semibold" />
                        {p.target > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {t.rich("ofTarget", { amount: () => <Money cents={p.target} /> })}
                          </span>
                        )}
                      </FlashOnChange>
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
                      {fromSavedLine(g)}
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
              // Saved money stays in the fund until returned, so it isn't filtered by year (R4).
              const saved = (savedThisYear(g, data.contributions) +
                netFromSaved(g.id, data.savedMoves)) as Cents;
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
                        <Badge variant="outline">
                          <GOAL_KIND_ICONS.sinking_fund aria-hidden="true" focusable="false" />
                          {t("kinds.sinking_fund")}
                        </Badge>
                        {statusBadge(g)}
                      </CardTitle>
                      <CardDescription>
                        {t.rich("annualTarget", { amount: () => <Money cents={annual} /> })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <FlashOnChange
                        value={saved}
                        className="-mx-2 flex items-baseline justify-between gap-2 rounded-lg px-2 py-1"
                      >
                        <Money cents={saved} className="text-2xl font-semibold" />
                        <span className="text-sm text-muted-foreground">
                          {t("savedThisYear", { year: String(year) })}
                        </span>
                      </FlashOnChange>
                      <ProgressBar
                        value={annual > 0 ? saved / annual : 0}
                        label={t("progressLabel", { name: g.name })}
                      />
                      {contributionLine(g)}
                      {fromSavedLine(g)}
                      {actions(g)}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          {data.goals
            .filter((g) => g.kind === "purchase")
            .sort(byStatus)
            .map((g) => {
              const p = purchaseProgress(g, data.savedMoves);
              return (
                <li key={g.id}>
                  <Card
                    data-testid="goal-card"
                    data-kind={g.kind}
                    className={g.archived ? "opacity-70" : undefined}
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <ShoppingBag aria-hidden="true" className="size-4 text-muted-foreground" />
                        {g.name}
                        <Badge variant="outline">
                          <GOAL_KIND_ICONS.purchase aria-hidden="true" focusable="false" />
                          {t("kinds.purchase")}
                        </Badge>
                        {statusBadge(g)}
                      </CardTitle>
                      {g.targetMonth && (
                        <CardDescription data-testid="goal-target-month">
                          {t("targetBy", { month: formatMonth(g.targetMonth, locale, "long") })}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <FlashOnChange
                        value={p.saved}
                        className="-mx-2 flex items-baseline justify-between gap-2 rounded-lg px-2 py-1"
                      >
                        <Money cents={p.saved} className="text-2xl font-semibold" />
                        <span className="text-sm text-muted-foreground">
                          {t.rich("ofTarget", { amount: () => <Money cents={p.target} /> })}
                        </span>
                      </FlashOnChange>
                      <ProgressBar value={p.ratio} label={t("progressLabel", { name: g.name })} />
                      {actions(g)}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
        </ul>
      )}

      {move && (
        <SavedMoveDialog
          key={`${move.mode}-${move.goal.id}`}
          open
          onOpenChange={(open) => !open && setMove(null)}
          mode={move.mode}
          goal={move.goal}
          max={move.max}
        />
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
