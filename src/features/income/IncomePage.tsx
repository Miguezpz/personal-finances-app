"use client";

/**
 * Income list (T065): each income with its allocations by bucket and investment vehicle,
 * edit (recalculated with its original rule) and delete (balances recalculate, FR-016a).
 */
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AccountMark } from "@/components/icons/AccountMark";
import { BUCKET_ICONS } from "@/components/icons/domain-icons";
import { INCOME_TYPE_ICONS } from "@/components/icons/income-type-icons";
import { navIcon } from "@/components/layout/nav-items";
import { PageHeader } from "@/components/layout/PageHeader";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { Account, FinanceSnapshot, Income, IncomeAllocation } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";
import { openCreate } from "@/store/ui";
import { formatPeriodRange } from "./format";
import { useIncomes } from "./hooks";
import { useDeferredDelete } from "@/features/shared/use-deferred-delete";

const selectAccounts = (s: FinanceSnapshot) => s.accounts;
const BUCKET_ORDER = { needs: 0, wants: 1, investment: 2 } as const;

function IncomeCard({
  income,
  allocations,
  accountName,
  accountOf,
  onEdit,
  onDelete,
}: {
  income: Income;
  allocations: readonly IncomeAllocation[];
  accountName: (id: string | null) => string;
  accountOf: (id: string | null) => Account | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("income");
  const tb = useTranslations("buckets");
  const locale = usePreferences(selectLocale);
  const sorted = [...allocations].sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket]);
  const TypeIcon = INCOME_TYPE_ICONS[income.incomeType];

  return (
    <Card data-testid="income-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="truncate">{income.label}</span>
            <Badge variant="outline" data-testid="income-type-badge">
              <TypeIcon aria-hidden="true" focusable="false" />
              {t(`type.${income.incomeType}`)}
            </Badge>
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
            {sorted.map((a) => {
              const BucketIcon = BUCKET_ICONS[a.bucket];
              const account = accountOf(a.accountId);
              return (
                <li
                  key={a.id}
                  className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-1.5"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                    <BucketIcon
                      aria-hidden="true"
                      focusable="false"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    {tb(a.bucket)}
                    {a.accountId && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        ·{account && <AccountMark account={account} className="size-3.5" />}
                        {accountName(a.accountId)}
                      </span>
                    )}
                  </span>
                  <Money cents={a.amount} />
                </li>
              );
            })}
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
  const { remove } = useDeferredDelete();

  const accountName = (id: string | null) => accounts?.find((a) => a.id === id)?.name ?? "";
  const accountOf = (id: string | null) => accounts?.find((a) => a.id === id) ?? null;
  const incomes = data
    ? [...data.incomes].sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : -1))
    : [];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        icon={navIcon("/income")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/settings/rules">
                <Settings2 aria-hidden="true" />
                {tr("title")}
              </Link>
            </Button>
          </>
        }
      />

      {!data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : incomes.length === 0 ? (
        <EmptyState
          icon={navIcon("/income")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreate({ kind: "income" })}
              data-testid="empty-register-income"
            >
              <Plus aria-hidden="true" />
              {t("register")}
            </Button>
          }
        >
          {t("empty")}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {incomes.map((income) => (
            <li key={income.id}>
              <IncomeCard
                income={income}
                allocations={data.allocations.filter((a) => a.incomeId === income.id)}
                accountName={accountName}
                accountOf={accountOf}
                onEdit={() => openCreate({ kind: "income", income })}
                onDelete={() =>
                  remove({
                    kind: "income",
                    id: income.id,
                    label: tc("deletedItem", { name: income.label }),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
