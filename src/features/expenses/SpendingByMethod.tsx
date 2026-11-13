"use client";

/**
 * How much was spent with each payment method in the quincena chosen in the page header (spec 009):
 * cash and credit cards always show, even at $0; any other account (debit, savings, archived…)
 * only when it was used; "unspecified" when some expense has no method. Cards' debt lives in
 * Credit; this is spending, so card payments never count.
 */
import { ChevronLeft, ChevronRight, CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AccountMark } from "@/components/icons/AccountMark";
import { Money } from "@/components/money/Money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { periodOfDate, withRange } from "@/domain/pay-calendar";
import { nextPeriod, previousPeriod } from "@/domain/periods";
import { spendingByPaymentMethod } from "@/domain/spending-by-method";
import { ZERO_CENTS } from "@/domain/money";
import type { FinanceSnapshot, Period } from "@/domain/types";
import { formatPeriodRange } from "@/features/income/format";
import { groupPaymentAccounts } from "@/features/settings/accounts/PaymentAccountOptions";
import { usePayCalendar } from "@/lib/use-pay-calendar";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";

const selectData = (s: FinanceSnapshot) => ({ expenses: s.expenses, accounts: s.accounts });

/** Previous / next quincena (spec 009, FR-019): lives in the Expenses page header. */
export function PeriodNavigator({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const t = useTranslations("expenses");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const calendar = usePayCalendar();
  const isCurrent = period.key >= periodOfDate(today, calendar).key;
  return (
    <div className="flex items-center gap-1 text-sm" data-testid="expenses-period">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t("previousQuincena")}
        onClick={() => onChange(withRange(previousPeriod(period), calendar))}
        data-testid="spending-previous"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <span className="px-2 tabular-nums" data-testid="spending-period">
        {t("spendingPeriod", formatPeriodRange(period, locale))}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t("nextQuincena")}
        disabled={isCurrent}
        onClick={() => onChange(withRange(nextPeriod(period), calendar))}
        data-testid="spending-next"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

export function SpendingByMethod({ period }: { period: Period }) {
  const t = useTranslations("expenses");
  const locale = usePreferences(selectLocale);
  const { data } = useFinanceSnapshot(selectData);

  const summary = useMemo(() => {
    if (!data) return null;
    const spending = spendingByPaymentMethod(data.expenses, data.accounts, period);
    const shown = data.accounts.filter(
      (a) =>
        spending.byAccount.has(a.id) ||
        (!a.archived && (a.kind === "cash" || a.kind === "credit_card")),
    );
    const rows = groupPaymentAccounts(shown, locale).flatMap((g) => g.accounts);
    return { spending, rows };
  }, [data, period, locale]);

  return (
    <section
      aria-labelledby="spending-by-method"
      className="flex flex-col gap-3"
      data-testid="spending-by-method"
      data-period={period.key}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="spending-by-method" className="text-lg font-semibold tracking-tight">
          {t("spendingByMethodTitle")}
        </h2>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {!summary ? (
            <div className="flex flex-col gap-2 p-4" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : (
            <dl className="divide-y text-sm">
              {summary.rows.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                  data-testid="spending-row"
                  data-account={account.id}
                >
                  <dt className="flex min-w-0 items-center gap-2">
                    <AccountMark account={account} className="size-5" />
                    <span className="truncate">{account.name}</span>
                  </dt>
                  <dd className="font-medium whitespace-nowrap">
                    <Money cents={summary.spending.byAccount.get(account.id) ?? ZERO_CENTS} />
                  </dd>
                </div>
              ))}
              {summary.spending.unspecified > 0 && (
                <div
                  className="flex items-center justify-between gap-4 px-4 py-3"
                  data-testid="spending-row"
                  data-account="none"
                >
                  <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <CircleHelp aria-hidden="true" focusable="false" className="size-5 shrink-0" />
                    <span className="truncate">{t("noPaymentMethod")}</span>
                  </dt>
                  <dd className="font-medium whitespace-nowrap">
                    <Money cents={summary.spending.unspecified} />
                  </dd>
                </div>
              )}
              <div
                className="flex items-center justify-between gap-4 bg-muted/40 px-4 py-3 font-semibold"
                data-testid="spending-total"
              >
                <dt>{t("spendingTotal")}</dt>
                <dd className="whitespace-nowrap">
                  <Money cents={summary.spending.total} />
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
