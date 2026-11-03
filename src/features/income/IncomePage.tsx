"use client";

/**
 * Income list (T065): each income with its allocations by bucket and investment vehicle,
 * edit (recalculated with its original rule) and delete (balances recalculate, FR-016a).
 */
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
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
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot, Income, IncomeAllocation } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";
import { formatPeriodRange } from "./format";
import { useDeleteIncome, useIncomes } from "./hooks";
import { RegisterIncomeDialog } from "./RegisterIncomeDialog";

const selectAccounts = (s: FinanceSnapshot) => s.accounts;
const BUCKET_ORDER = { needs: 0, wants: 1, investment: 2 } as const;

function IncomeCard({
  income,
  allocations,
  accountName,
  onEdit,
  onDelete,
}: {
  income: Income;
  allocations: readonly IncomeAllocation[];
  accountName: (id: string | null) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("income");
  const tb = useTranslations("buckets");
  const locale = usePreferences(selectLocale);
  const sorted = [...allocations].sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]);

  return (
    <Card data-testid="income-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="truncate">{income.label}</span>
            {!income.isRecurring && <Badge variant="secondary">{t("oneOffBadge")}</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("receivedLabel", { date: formatDate(income.receivedOn, locale) })} ·{" "}
            {t("fundsLabel", {
              range: t("periodRange", formatPeriodRange(income.fundedPeriodStart, locale)),
            })}
          </p>
        </div>
        <Money cents={income.amount} className="text-lg font-semibold" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {income.distributed ? (
          <ul className="grid gap-1 text-sm sm:grid-cols-2" aria-label={t("preview")}>
            {sorted.map((a) => (
              <li
                key={a.id}
                className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-1.5"
              >
                <span>
                  {tb(a.bucket)}
                  {a.accountId && (
                    <span className="text-muted-foreground"> · {accountName(a.accountId)}</span>
                  )}
                </span>
                <Money cents={a.amount} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notSplit")}</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            {t("edit")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            {t("delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IncomePage() {
  const t = useTranslations("income");
  const tr = useTranslations("rules");
  const tc = useTranslations("common");
  const { data } = useIncomes();
  const { data: accounts } = useFinanceSnapshot(selectAccounts);
  const deleteIncome = useDeleteIncome();
  const [dialog, setDialog] = useState<{ open: boolean; income: Income | null }>({
    open: false,
    income: null,
  });
  const [toDelete, setToDelete] = useState<Income | null>(null);

  const accountName = (id: string | null) => accounts?.find((a) => a.id === id)?.name ?? "";
  const incomes = data
    ? [...data.incomes].sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : -1))
    : [];

  function confirmDelete() {
    if (!toDelete) return;
    deleteIncome.mutate(toDelete.id, {
      onSuccess: () => toast.success(t("deleted")),
      onError: (e) => {
        if (!isNotifiedGlobally(e)) toast.error(tc("unexpectedError"));
      },
    });
    setToDelete(null);
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/settings/rules">
              <Settings2 aria-hidden="true" />
              {tr("title")}
            </Link>
          </Button>
          <Button
            onClick={() => setDialog({ open: true, income: null })}
            data-testid="register-income"
          >
            <Plus aria-hidden="true" />
            {t("register")}
          </Button>
        </div>
      </header>

      {!data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : incomes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {incomes.map((income) => (
            <li key={income.id}>
              <IncomeCard
                income={income}
                allocations={data.allocations.filter((a) => a.incomeId === income.id)}
                accountName={accountName}
                onEdit={() => setDialog({ open: true, income })}
                onDelete={() => setToDelete(income)}
              />
            </li>
          ))}
        </ul>
      )}

      {dialog.open && (
        <RegisterIncomeDialog
          key={dialog.income?.id ?? "new"}
          open={dialog.open}
          income={dialog.income}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
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
