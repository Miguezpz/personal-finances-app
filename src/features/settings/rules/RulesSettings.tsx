"use client";

/** Rules settings screen (T063): current rule + editor + read-only version history. */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { effectiveRule } from "@/domain/splitter";
import type { DistributionRule } from "@/domain/types";
import { useIncomes } from "@/features/income/hooks";
import { formatDate, formatPercent } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { useInvestmentAccounts, useRules } from "./hooks";
import { RuleForm } from "./RuleForm";

export function RulesSettings() {
  const t = useTranslations("rules");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const rules = useRules();
  const incomes = useIncomes();
  const vehicles = useInvestmentAccounts();

  if (!rules.data || !incomes.data || !vehicles.data) {
    return <Skeleton className="h-96" aria-busy="true" />;
  }

  const current = effectiveRule(rules.data, today);
  const history = [...rules.data]
    .filter((r) => r.id !== current?.id)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  const describe = (r: DistributionRule) =>
    t("historyItem", {
      date: formatDate(r.effectiveFrom, locale),
      needs: formatPercent(r.needs, locale),
      wants: formatPercent(r.wants, locale),
      investment: formatPercent(r.investment, locale),
    });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("currentRule")}</CardTitle>
          <CardDescription>
            {current
              ? t("inEffectSince", { date: formatDate(current.effectiveFrom, locale) })
              : t("noRule")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Re-mount the form when the current rule changes so it shows the saved values. */}
          <RuleForm
            key={current?.id ?? "none"}
            current={current}
            rules={rules.data}
            incomes={incomes.data.incomes}
            vehicles={vehicles.data}
            today={today}
          />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <section aria-labelledby="rule-history" className="flex flex-col gap-2">
          <h2 id="rule-history" className="text-sm font-medium">
            {t("history")}
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {history.map((r) => (
              <li key={r.id}>{describe(r)}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
