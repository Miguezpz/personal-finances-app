"use client";

/**
 * The monthly payment session on Credit (spec 011, US5, FR-028/030, contracts/ui.md): the days
 * when every card can be paid in one sitting, each card with its due date, state and "Ya la
 * pagué". A finished session says so and shows the next one. Hidden when no card has terms.
 */
import { CalendarCheck, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { AccountMark } from "@/components/icons/AccountMark";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentSession, SessionCard } from "@/domain/payment-sessions";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";
import { MarkPaidButton, UnmarkButton } from "./MarkPaidButton";
import { usePaymentSession } from "./use-card-statements";

export function useSessionWindowLabel() {
  const t = useTranslations("credit");
  const locale = usePreferences(selectLocale);
  return (window: PaymentSession["window"]) =>
    window.start === window.end
      ? formatDate(window.start, locale, "short")
      : t("sessionWindow", {
          start: formatDate(window.start, locale, "short"),
          end: formatDate(window.end, locale, "short"),
        });
}

const STATE_KEY = {
  paid: "statePaid",
  nothing: "stateNothing",
  pending: "statePending",
  overdue: "stateOverdue",
} as const;

/** One card of a session: name, due date, amount or state, and its action. */
export function SessionCardRow({ item }: { item: SessionCard }) {
  const t = useTranslations("credit");
  const locale = usePreferences(selectLocale);
  const today = useToday();
  const { card, statement } = item;
  const open = statement.state === "pending" || statement.state === "overdue";
  // Only a closed statement can be marked (FR-008); one still open shows when it closes.
  const closed = statement.cutOff <= today;
  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm"
      data-testid="session-card"
      data-card={card.id}
      data-state={statement.state}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <AccountMark account={card} className="size-6" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{card.name}</span>
          <span className="text-xs text-muted-foreground">
            {t("sessionCardDue", { date: formatDate(statement.due, locale, "short") })}
            {!closed && (
              <>
                {" "}
                · {t("sessionClosesOn", { date: formatDate(statement.cutOff, locale, "short") })}
              </>
            )}
          </span>
        </span>
      </span>
      {open ? (
        <Money cents={statement.outstanding} className="font-semibold whitespace-nowrap" />
      ) : (
        <Badge variant="secondary" className="gap-1">
          {statement.state === "paid" && <CircleCheck aria-hidden="true" />}
          {t(STATE_KEY[statement.state])}
        </Badge>
      )}
      {open && closed ? (
        <MarkPaidButton card={card} cutOff={statement.cutOff} />
      ) : statement.state === "paid" && statement.markId !== null ? (
        <UnmarkButton card={card} mark={{ id: statement.markId, cutOff: statement.cutOff }} />
      ) : null}
    </li>
  );
}

function SessionBlock({ session }: { session: PaymentSession }) {
  const t = useTranslations("credit");
  const label = useSessionWindowLabel();
  return (
    <div className="flex flex-col gap-1" data-testid="session" data-done={session.done}>
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <span data-testid="session-window">{label(session.window)}</span>
        {session.done && (
          <Badge variant="secondary" className="gap-1" data-testid="session-done">
            <CircleCheck aria-hidden="true" />
            {t("sessionDone")}
          </Badge>
        )}
      </p>
      <ul className="divide-y">
        {session.cards.map((item) => (
          <SessionCardRow key={item.card.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function PaymentSessionCard() {
  const t = useTranslations("credit");
  const label = useSessionWindowLabel();
  const sessions = usePaymentSession();
  if (!sessions) return null;
  const { current, next } = sessions;
  const shown = current.length > 0 ? current : next ? [next] : [];
  if (shown.length === 0) return null;
  const allDone = shown.every((s) => s.done);

  return (
    <Card data-testid="payment-session">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck aria-hidden="true" className="size-5 text-primary" />
          {t("sessionTitle")}
        </CardTitle>
        <CardDescription>{t("sessionHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {shown.map((session) => (
          <SessionBlock key={session.window.start} session={session} />
        ))}
        {allDone && next && !shown.includes(next) && (
          <p className="text-sm text-muted-foreground" data-testid="session-next">
            {t("sessionNext", { window: label(next.window) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
