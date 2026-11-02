"use client";

/**
 * Expenses (T092): card debt summary, and every expense and card payment, newest first, with edit
 * and delete. Automatic (recurring) charges are labelled; third-party MSI charges never appear
 * here — they aren't personal expenses (FR-020).
 */
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { negateCents } from "@/domain/money";
import type { CardPayment, Cents, Expense, FinanceSnapshot, IsoDate, Uuid } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { formatDate } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { CardDebtSummary } from "./CardDebtSummary";
import { CardPaymentDialog } from "./CardPaymentDialog";
import { useDeleteCardPayment, useDeleteExpense } from "./hooks";

const PAGE = 50;

type Row =
  | { kind: "expense"; date: IsoDate; item: Expense }
  | { kind: "payment"; date: IsoDate; item: CardPayment };

const selectData = (s: FinanceSnapshot) => s;

export function ExpensesPage() {
  const t = useTranslations("expenses");
  const tb = useTranslations("buckets");
  const tc = useTranslations("common");
  const locale = usePreferences(selectLocale);
  const nameOf = useTaxonomyName();
  const { data } = useFinanceSnapshot(selectData);
  const deleteExpense = useDeleteExpense();
  const deletePayment = useDeleteCardPayment();
  const [visible, setVisible] = useState(PAGE);
  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; expense: Expense | null }>({
    open: false,
    expense: null,
  });
  const [payDialog, setPayDialog] = useState<{
    open: boolean;
    cardId: Uuid | null;
    amount: Cents | null;
  }>({
    open: false,
    cardId: null,
    amount: null,
  });
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    return [
      ...data.expenses.map((item): Row => ({ kind: "expense", date: item.spentOn, item })),
      ...data.cardPayments.map((item): Row => ({ kind: "payment", date: item.paidOn, item })),
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [data]);

  const subName = (id: string) => {
    const sub = data?.subcategories.find((x) => x.id === id);
    return sub ? nameOf(sub) : "";
  };
  const accountName = (id: string | null) => data?.accounts.find((a) => a.id === id)?.name ?? null;
  const onError = (e: Error) => {
    if (!isDemoReadOnlyError(e)) toast.error(tc("unexpectedError"));
  };

  function confirmDelete() {
    if (!toDelete) return;
    if (toDelete.kind === "expense")
      deleteExpense.mutate(toDelete.item.id, {
        onSuccess: () => toast.success(t("deleted")),
        onError,
      });
    else
      deletePayment.mutate(toDelete.item.id, {
        onSuccess: () => toast.success(t("deleted")),
        onError,
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
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setPayDialog({ open: true, cardId: null, amount: null })}
          >
            <CreditCard aria-hidden="true" />
            {t("payCard")}
          </Button>
          <Button
            onClick={() => setExpenseDialog({ open: true, expense: null })}
            data-testid="add-expense"
          >
            <Plus aria-hidden="true" />
            {t("addTitle")}
          </Button>
        </div>
      </header>

      <CardDebtSummary onPay={(cardId, amount) => setPayDialog({ open: true, cardId, amount })} />

      <section aria-labelledby="movements" className="flex flex-col gap-3">
        <h2 id="movements" className="text-lg font-semibold tracking-tight">
          {t("movements")}
        </h2>
        {!data ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <>
            <ul className="divide-y rounded-lg border">
              {rows.slice(0, visible).map((row) => (
                <li
                  key={`${row.kind}-${row.item.id}`}
                  data-testid={row.kind === "expense" ? "expense-row" : "payment-row"}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 text-sm sm:grid-cols-[6rem_1fr_auto]"
                >
                  <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:text-sm">
                    {formatDate(row.date, locale, "short")}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {row.kind === "expense" ? (
                      <>
                        <span className="truncate font-medium">
                          {row.item.note ?? subName(row.item.subcategoryId)}
                        </span>
                        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          {subName(row.item.subcategoryId)}
                          <Badge variant="outline">{tb(row.item.bucket)}</Badge>
                          {row.item.origin === "recurring" && (
                            <Badge variant="secondary">{t("automatic")}</Badge>
                          )}
                          {accountName(row.item.paymentAccountId) && (
                            <>· {accountName(row.item.paymentAccountId)}</>
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="truncate font-medium">
                          {t("cardPaymentLabel", {
                            card: accountName(row.item.cardAccountId) ?? "",
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.item.note ?? t("debtSettlement")}
                          {accountName(row.item.fromAccountId) && (
                            <> · {accountName(row.item.fromAccountId)}</>
                          )}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    <Money
                      cents={negateCents(row.item.amount)}
                      signed
                      className="mr-1 font-medium whitespace-nowrap"
                    />
                    {row.kind === "expense" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("edit")}
                        onClick={() => setExpenseDialog({ open: true, expense: row.item })}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("delete")}
                      onClick={() => setToDelete(row)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            {rows.length > visible && (
              <Button
                variant="outline"
                className="self-center"
                onClick={() => setVisible((v) => v + PAGE)}
              >
                {t("showMore")}
              </Button>
            )}
          </>
        )}
      </section>

      {expenseDialog.open && (
        <AddExpenseDialog
          key={expenseDialog.expense?.id ?? "new"}
          open={expenseDialog.open}
          expense={expenseDialog.expense}
          onOpenChange={(open) => setExpenseDialog((d) => ({ ...d, open }))}
        />
      )}
      {payDialog.open && (
        <CardPaymentDialog
          key={payDialog.cardId ?? "any"}
          open={payDialog.open}
          cardId={payDialog.cardId}
          suggestedAmount={payDialog.amount}
          onOpenChange={(open) => setPayDialog((d) => ({ ...d, open }))}
        />
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {toDelete?.kind === "payment" ? t("deletePaymentTitle") : t("deleteTitle")}
            </DialogTitle>
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
