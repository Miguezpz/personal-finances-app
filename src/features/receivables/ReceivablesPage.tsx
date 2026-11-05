"use client";

/**
 * Receivables (T100, US5): balance per debtor, and every MSI purchase for third parties with its
 * collection calendar (collect-by date, card due date, amount, status) and a "record collection"
 * action per installment. Nothing here affects the personal budget (FR-020).
 */
import { Plus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveCtaButton } from "@/components/ui/responsive-cta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { debtorBalance, receivableBalance } from "@/domain/installments";
import type { Installment } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { selectLocale, usePreferences } from "@/store/preferences";
import { AddReceivableDialog } from "./AddReceivableDialog";
import { CollectionDialog } from "./CollectionDialog";
import { useReceivables } from "./hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { navIcon } from "@/components/layout/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { RECEIVABLE_STATUS_ICONS } from "@/components/icons/domain-icons";

const STATUS_STYLE: Record<Installment["status"], string> = {
  collected: "bg-surface-highlight text-success",
  partial: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  pending: "bg-muted text-foreground",
};

export function ReceivablesPage() {
  const t = useTranslations("receivables");
  const locale = usePreferences(selectLocale);
  const { data } = useReceivables();
  const [adding, setAdding] = useState(false);
  const [collecting, setCollecting] = useState<Installment | null>(null);

  const debtorName = (id: string) => data?.debtors.find((d) => d.id === id)?.name ?? "";
  const cardName = (id: string) => data?.cards.find((c) => c.id === id)?.name ?? "";
  const receivables = data
    ? [...data.receivables].sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))
    : [];
  const collectingReceivable = collecting
    ? data?.receivables.find((r) => r.id === collecting.receivableId)
    : undefined;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        icon={navIcon("/receivables")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <ResponsiveCtaButton
              className="shrink-0"
              onClick={() => setAdding(true)}
              data-testid="add-receivable"
            >
              <Plus aria-hidden="true" />
              {t("addTitle")}
            </ResponsiveCtaButton>
          </>
        }
      />

      {!data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      ) : receivables.length === 0 ? (
        <EmptyState icon={navIcon("/receivables")}>{t("empty")}</EmptyState>
      ) : (
        <>
          <section aria-labelledby="debtors" className="flex flex-col gap-3">
            <h2 id="debtors" className="text-lg font-semibold tracking-tight">
              {t("debtors")}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.debtors.map((debtor) => (
                <li key={debtor.id}>
                  <Card data-testid="debtor-card">
                    <CardContent className="flex items-center justify-between gap-4">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <UserRound
                          aria-hidden="true"
                          focusable="false"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate">{debtor.name}</span>
                      </span>
                      <span className="flex flex-col items-end text-sm">
                        <span className="text-xs text-muted-foreground">{t("owes")}</span>
                        <Money
                          cents={debtorBalance(data.installments, data.receivables, debtor.id)}
                          className="font-semibold"
                        />
                      </span>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="purchases" className="flex flex-col gap-3">
            <h2 id="purchases" className="text-lg font-semibold tracking-tight">
              {t("purchases")}
            </h2>
            <ul className="flex flex-col gap-4">
              {receivables.map((r) => {
                const rows = data.installments
                  .filter((i) => i.receivableId === r.id)
                  .sort((a, b) => a.seq - b.seq);
                return (
                  <li key={r.id}>
                    <Card data-testid="receivable-card">
                      <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-1">
                          <CardTitle className="truncate text-base">{r.description}</CardTitle>
                          <CardDescription>
                            {t("purchaseMeta", {
                              debtor: debtorName(r.debtorId),
                              card: cardName(r.cardAccountId),
                              date: formatDate(r.purchaseDate, locale),
                              months: r.termMonths,
                            })}
                          </CardDescription>
                        </div>
                        <div className="flex shrink-0 flex-col items-end text-sm">
                          <Money cents={r.total} className="font-semibold" />
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {t("remaining")}{" "}
                            <Money cents={receivableBalance(data.installments, r.id)} />
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <table className="w-full min-w-[34rem] text-sm">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              <th className="py-1 font-normal">#</th>
                              <th className="py-1 font-normal">{t("collectBy")}</th>
                              <th className="py-1 font-normal">{t("cardDue")}</th>
                              <th className="py-1 text-right font-normal">{t("amount")}</th>
                              <th className="py-1 pl-3 font-normal">{t("statusLabel")}</th>
                              <th className="py-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((i) => (
                              <tr
                                key={i.id}
                                className="border-t"
                                data-testid="installment-row"
                                data-status={i.status}
                              >
                                <td className="py-2">{i.seq}</td>
                                <td className="py-2">{formatDate(i.dueOn, locale, "short")}</td>
                                <td className="py-2 text-muted-foreground">
                                  {formatDate(i.cardDueOn, locale, "short")}
                                </td>
                                <td className="py-2 text-right">
                                  <Money cents={i.amount} />
                                </td>
                                <td className="py-2 pl-3">
                                  <Badge className={cn("font-normal", STATUS_STYLE[i.status])}>
                                    <StatusIcon status={i.status} />
                                    {t(`status.${i.status}`)}
                                    {i.status === "partial" && (
                                      <>
                                        {" "}
                                        · <Money cents={i.collected} />
                                      </>
                                    )}
                                  </Badge>
                                </td>
                                <td className="py-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCollecting(i)}
                                    data-testid="record-collection"
                                  >
                                    {t("record")}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {adding && <AddReceivableDialog open={adding} onOpenChange={setAdding} />}
      {collecting && collectingReceivable && (
        <CollectionDialog
          key={collecting.id}
          open
          installment={collecting}
          debtorName={debtorName(collectingReceivable.debtorId)}
          cardName={cardName(collectingReceivable.cardAccountId)}
          onOpenChange={(open) => !open && setCollecting(null)}
        />
      )}
    </section>
  );
}

function StatusIcon({ status }: { status: Installment["status"] }) {
  const Icon = RECEIVABLE_STATUS_ICONS[status];
  return <Icon aria-hidden="true" focusable="false" />;
}
