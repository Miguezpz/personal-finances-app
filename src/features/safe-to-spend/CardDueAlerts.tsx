"use client";

/**
 * Cards to pay soon, as a one-line notice on the Dashboard: how many cards have their last
 * statement unpaid and due within 7 days (or overdue), or are pending in a payment session that
 * starts within 7 days (spec 011, FR-029), with a link to Credit. Paying and marking cards happens
 * only in Credit; this notice just tells you to go there. Uses the same statement summary as
 * Credit, so a statement with nothing recorded never counts.
 */
import { ChevronRight, CreditCard } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { daysBetween } from "@/domain/dates";
import type { PaymentSession } from "@/domain/payment-sessions";
import {
  useCardStatements,
  usePaymentSession,
  type CardStatement,
} from "@/features/credit/use-card-statements";
import { useToday } from "@/lib/use-today";

const CARD_DUE_WINDOW_DAYS = 7;

interface CardDue {
  statement: CardStatement;
  /** Days until the due date; negative when overdue. */
  days: number;
}

/**
 * The payment session to announce (spec 011, FR-029): the next unfinished one, from 7 days before
 * its window starts until it ends. Null otherwise.
 */
function useSessionAlert(): PaymentSession | null {
  const today = useToday();
  const sessions = usePaymentSession();
  const next = sessions?.next ?? null;
  if (!next || next.phase === "past") return null;
  return daysBetween(today, next.window.start) <= CARD_DUE_WINDOW_DAYS ? next : null;
}

/** Cards due soon, except those already announced by the session alert (unless overdue). */
function useCardDueAlerts(): CardDue[] {
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

/** "2 cards to pay soon" + "See in Credit" (nothing when no card is due). */
export function CardDueAlerts() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("credit");
  const alerts = useCardDueAlerts();
  const session = useSessionAlert();
  // A card can be both overdue and in the session: count it once.
  const ids = new Set(alerts.map((a) => a.statement.card.id));
  for (const c of session?.cards ?? [])
    if (c.statement.state === "pending" || c.statement.state === "overdue") ids.add(c.card.id);
  if (ids.size === 0) return null;
  const overdue = alerts.some((a) => a.days < 0);
  return (
    <Alert
      variant={overdue ? "destructive" : "default"}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      data-testid="card-due-alerts"
      data-count={ids.size}
    >
      <AlertTitle className="flex items-center gap-2">
        <CreditCard aria-hidden="true" className="size-4 shrink-0" />
        {t(overdue ? "cardsOverdueNotice" : "cardsDueNotice", { count: ids.size })}
      </AlertTitle>
      <Button asChild size="sm" variant="outline" className="pointer-coarse:min-h-11">
        <Link href="/credit" data-testid="card-due-see-credit">
          {tc("seeInCredit")}
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </Alert>
  );
}
