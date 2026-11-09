"use client";

/**
 * Cards to pay soon (spec 009, US6, FR-025): every card whose last statement is still unpaid and
 * due within 7 days — or already overdue — with its amount and "Ya la pagué" (spec 011). Uses the
 * same statement summary as Credit and Expenses (spec 008), so the amount always matches; a
 * statement with nothing recorded never alerts. From 7 days before the monthly payment session
 * (spec 011, FR-029) one session alert lists its cards instead of one alert per card.
 */
import { CalendarCheck, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AccountMark } from "@/components/icons/AccountMark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { daysBetween } from "@/domain/dates";
import { StatementAmount } from "@/features/credit/CardStatementCard";
import { MarkPaidButton } from "@/features/credit/MarkPaidButton";
import { SessionCardRow, useSessionWindowLabel } from "@/features/credit/PaymentSessionCard";
import {
  useCardStatements,
  usePaymentSession,
  type CardStatement,
} from "@/features/credit/use-card-statements";
import type { PaymentSession } from "@/domain/payment-sessions";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

export const CARD_DUE_WINDOW_DAYS = 7;

export interface CardDue {
  statement: CardStatement;
  /** Days until the due date; negative when overdue. */
  days: number;
}

/**
 * The payment session to announce (spec 011, FR-029): the next unfinished one, from 7 days before
 * its window starts until it ends. Null otherwise.
 */
export function useSessionAlert(): PaymentSession | null {
  const today = useToday();
  const sessions = usePaymentSession();
  const next = sessions?.next ?? null;
  if (!next || next.phase === "past") return null;
  return daysBetween(today, next.window.start) <= CARD_DUE_WINDOW_DAYS ? next : null;
}

/** Cards due soon, except those already announced by the session alert (unless overdue). */
export function useCardDueAlerts(): CardDue[] {
  const today = useToday();
  const statements = useCardStatements();
  const session = useSessionAlert();
  return useMemo(() => {
    const inSession = new Set(session?.cards.map((c) => c.card.id) ?? []);
    return (statements ?? [])
      .filter((s) => s.summary.last.state === "pending" || s.summary.last.state === "overdue")
      .filter((s) => s.summary.last.state === "overdue" || !inSession.has(s.card.id))
      .map((statement) => ({ statement, days: daysBetween(today, statement.summary.last.due) }))
      .filter((a) => a.days <= CARD_DUE_WINDOW_DAYS)
      .sort((a, b) => a.days - b.days);
  }, [statements, today, session]);
}

/** "Next payment session: Nov 10 – 12" or "Time to pay your cards", with the pending cards. */
export function SessionAlert({
  session,
  className,
}: {
  session: PaymentSession;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  const label = useSessionWindowLabel();
  const pending = session.cards.filter(
    (c) => c.statement.state === "pending" || c.statement.state === "overdue",
  );
  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-testid="session-alert"
      data-phase={session.phase}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarCheck aria-hidden="true" className="size-4 shrink-0" />
        {session.phase === "today"
          ? t("sessionToday")
          : t("sessionUpcoming", { window: label(session.window) })}
      </p>
      <ul className="divide-y">
        {pending.map((item) => (
          <SessionCardRow key={item.card.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

/**
 * One card to pay, sized for a phone: logo, the name with "$1,234 · Overdue" underneath (the amount first, so a narrow screen cuts the rest), and
 * "Ya la pagué" on the right — never more than two pieces side by side.
 */
export function CardDueRow({ alert, className }: { alert: CardDue; className?: string }) {
  const t = useTranslations("dashboard");
  const { card, summary } = alert.statement;
  const overdue = alert.days < 0;
  return (
    <div
      className={cn("flex items-center gap-3 text-sm", className)}
      data-testid="card-due-alert"
      data-card={card.id}
    >
      <AccountMark account={card} className="size-6" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{card.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          <StatementAmount
            cents={summary.last.outstanding}
            className="font-medium text-foreground"
            compact
          />
          {" · "}
          <span className={cn(overdue && "font-medium text-destructive")}>
            {overdue ? t("cardOverdue") : t("cardDueIn", { days: alert.days })}
          </span>
        </span>
      </span>
      <MarkPaidButton card={card} cutOff={summary.last.cutOff} />
    </div>
  );
}

/** Desktop: one alert listing the cards due soon (nothing when there are none). */
export function CardDueAlerts() {
  const t = useTranslations("dashboard");
  const alerts = useCardDueAlerts();
  const session = useSessionAlert();
  if (alerts.length === 0 && !session) return null;
  const overdue = alerts.some((a) => a.days < 0);
  // The icon goes inside the title (not as the Alert's own icon) so the rows use the full width;
  // minmax(0,1fr) lets the names truncate instead of widening the grid past the screen.
  return (
    <Alert
      variant={overdue ? "destructive" : "default"}
      className="grid-cols-[minmax(0,1fr)]"
      data-testid="card-due-alerts"
    >
      <AlertTitle className="flex items-center gap-2">
        <CreditCard aria-hidden="true" className="size-4 shrink-0" />
        {t("cardsDueTitle")}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3 pt-1">
        {session && <SessionAlert session={session} />}
        {alerts.map((a) => (
          <CardDueRow key={a.statement.card.id} alert={a} />
        ))}
      </AlertDescription>
    </Alert>
  );
}
