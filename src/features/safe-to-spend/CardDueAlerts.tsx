"use client";

/**
 * Cards to pay soon (spec 009, US6, FR-025): every card whose last statement is still unpaid and
 * due within 7 days — or already overdue — with its amount and "Ya la pagué" (spec 011). Uses the
 * same statement summary as Credit and Expenses (spec 008), so the amount always matches; a
 * statement with nothing recorded never alerts.
 */
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Money } from "@/components/money/Money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { daysBetween } from "@/domain/dates";
import { MarkPaidButton } from "@/features/credit/MarkPaidButton";
import { useCardStatements, type CardStatement } from "@/features/credit/use-card-statements";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

export const CARD_DUE_WINDOW_DAYS = 7;

export interface CardDue {
  statement: CardStatement;
  /** Days until the due date; negative when overdue. */
  days: number;
}

export function useCardDueAlerts(): CardDue[] {
  const today = useToday();
  const statements = useCardStatements();
  return useMemo(
    () =>
      (statements ?? [])
        .filter((s) => s.summary.last.state === "pending" || s.summary.last.state === "overdue")
        .map((statement) => ({ statement, days: daysBetween(today, statement.summary.last.due) }))
        .filter((a) => a.days <= CARD_DUE_WINDOW_DAYS)
        .sort((a, b) => a.days - b.days),
    [statements, today],
  );
}

export function CardDueRow({ alert, className }: { alert: CardDue; className?: string }) {
  const t = useTranslations("dashboard");
  const { card, summary } = alert.statement;
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}
      data-testid="card-due-alert"
      data-card={card.id}
    >
      <CreditCard aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 font-medium">
        {alert.days < 0
          ? t("cardOverdue", { card: card.name })
          : t("cardDueIn", { card: card.name, days: alert.days })}
      </span>
      <Money cents={summary.last.outstanding} className="font-semibold whitespace-nowrap" />
      <MarkPaidButton card={card} cutOff={summary.last.cutOff} />
    </div>
  );
}

/** Desktop: one alert listing the cards due soon (nothing when there are none). */
export function CardDueAlerts() {
  const tc = useTranslations("credit");
  const alerts = useCardDueAlerts();
  if (alerts.length === 0) return null;
  const overdue = alerts.some((a) => a.days < 0);
  return (
    <Alert variant={overdue ? "destructive" : "default"} data-testid="card-due-alerts">
      <CreditCard aria-hidden="true" />
      <AlertTitle>{tc("title")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        {alerts.map((a) => (
          <CardDueRow key={a.statement.card.id} alert={a} />
        ))}
      </AlertDescription>
    </Alert>
  );
}
