"use client";

/**
 * Expenses (T092): spending by payment method for the quincena, card debt summary, and every expense and card payment, newest first, with edit
 * and delete. Automatic (recurring) charges are labelled; third-party MSI charges never appear
 * here — they aren't personal expenses (FR-020).
 */
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { taxonomyIconFor } from "@/domain/icons";
import { negateCents } from "@/domain/money";
import type { CardPayment, Expense, FinanceSnapshot, IsoDate } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { formatDate } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";
import { openCreate } from "@/store/ui";
import { CardDebtSummary } from "./CardDebtSummary";
import { useDeleteCardPayment, useDeleteExpense } from "./hooks";
import { QuickExpensesSection } from "./QuickExpensesSection";
import { SpendingByMethod } from "./SpendingByMethod";

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
  const accountLabel = (id: string | null) => {
    const account = data?.accounts.find((a) => a.id === id);
    if (!account?.name) return null;
    return (
      <span className="inline-flex items-center gap-1">
        <AccountMark account={account} className="size-3.5" />
        {account.name}
      </span>
    );
  };
  const onError = (e: Error) => {
    if (!isNotifiedGlobally(e)) toast.error(tc("unexpectedError"));
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
      <PageHeader icon={navIcon("/expenses")} title={t("title")} description={t("description")} />

      <SpendingByMethod />

      <CardDebtSummary
        onPay={(cardId, amount) =>
          openCreate({ kind: "card-payment", cardId, suggestedAmount: amount })
        }
      />

      <QuickExpensesSection />

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
          <EmptyState
            icon={navIcon("/expenses")}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreate({ kind: "expense" })}
                data-testid="empty-add-expense"
              >
                <Plus aria-hidden="true" />
                {t("addTitle")}
              </Button>
            }
          >
            {t("empty")}
          </EmptyState>
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
                          <CategoryIcon
                            icon={taxonomyIconFor(row.item.subcategoryId, data)}
                            className="size-3.5"
                          />
                          {subName(row.item.subcategoryId)}
                          <BucketBadge bucket={row.item.bucket} label={tb(row.item.bucket)} />
                          {row.item.origin === "recurring" && (
                            <Badge variant="secondary">
                              <Repeat aria-hidden="true" focusable="false" />
                              {t("automatic")}
                            </Badge>
                          )}
                          {accountName(row.item.paymentAccountId) && (
                            <>· {accountLabel(row.item.paymentAccountId)}</>
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
                            <> · {accountLabel(row.item.fromAccountId)}</>
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
                        onClick={() => openCreate({ kind: "expense", expense: row.item })}
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

function BucketBadge({ bucket, label }: { bucket: Expense["bucket"]; label: string }) {
  const Icon = BUCKET_ICONS[bucket];
  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" focusable="false" />
      {label}
    </Badge>
  );
}
