"use client";

/**
 * A card's statements (spec 008, US3; spec 011): the last one (paid / pending / overdue) and the
 * next one, with "Ya la pagué" — or "Desmarcar" when the last one carries its own mark. The
 * headline is the last statement until it's marked as paid, then the next one — the same answer on
 * Credit (`full`) and Expenses (`compact`).
 */
import { CalendarClock, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { AccountMark } from "@/components/icons/AccountMark";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatementState } from "@/domain/credit";
import type { Cents } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { selectLocale, usePreferences } from "@/store/preferences";
import { MarkPaidButton, UnmarkButton } from "./MarkPaidButton";
import type { CardStatement } from "./use-card-statements";

const STATE_ICONS = { paid: CircleCheck, pending: Clock, overdue: TriangleAlert } as const;
const STATE_KEYS = {
  paid: "statePaid",
  pending: "statePending",
  overdue: "stateOverdue",
} as const;

function StateBadge({ state }: { state: StatementState }) {
  const t = useTranslations("credit");
  const Icon = STATE_ICONS[state];
  return (
    <Badge
      variant={state === "overdue" ? "destructive" : state === "paid" ? "secondary" : "outline"}
      className="gap-1"
      data-testid="statement-state"
    >
      <Icon aria-hidden="true" />
      {t(STATE_KEYS[state])}
    </Badge>
  );
}

/**
 * A statement's recorded amount, or "No purchases recorded" when there is none: the bank statement
 * may still have the family's purchases, so it's a fact, not "nothing to pay".
 */
/**
 * The statement amount, or "No purchases recorded" when it's zero. `compact` is for a secondary
 * line (phone rows): the short label, inheriting the line's size and color.
 */
export function StatementAmount({
  cents,
  className,
  compact = false,
}: {
  cents: Cents;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("credit");
  if (cents === 0)
    return (
      <span
        className={compact ? undefined : "text-sm font-normal text-muted-foreground"}
        data-testid="no-purchases"
      >
        {t(compact ? "noPurchasesShort" : "noPurchases")}
      </span>
    );
  return <Money cents={cents} {...(className ? { className } : {})} />;
}

/** "Ya la pagué" while the last statement is pending/overdue; "Desmarcar" when it has its own mark. */
function StatementAction({ statement }: { statement: CardStatement }) {
  const { card, summary } = statement;
  const { last } = summary;
  if (last.state === "pending" || last.state === "overdue")
    return <MarkPaidButton card={card} cutOff={last.cutOff} />;
  if (last.state === "paid" && last.markId !== null)
    return <UnmarkButton card={card} mark={{ id: last.markId, cutOff: last.cutOff }} />;
  return null;
}

export function CardStatementCard({
  statement,
  variant,
}: {
  statement: CardStatement;
  variant: "full" | "compact";
}) {
  const t = useTranslations("credit");
  const locale = usePreferences(selectLocale);
  const { card, summary } = statement;
  const { last, next, headline } = summary;
  const headlineDue = headline === "last" ? last.due : next.due;
  const headlineAmount = headline === "last" ? last.outstanding : next.amount;
  const headlineLabel = headline === "last" ? t("payToAvoidInterest") : t("nextStatement");

  if (variant === "compact") {
    return (
      <div
        data-testid="card-debt"
        data-card={card.id}
        data-state={last.state}
        data-overdue={last.state === "overdue"}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <AccountMark account={card} className="size-6" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{card.name}</span>
            <span className="text-xs text-muted-foreground">
              {headlineLabel} · {t("dueShort", { date: formatDate(headlineDue, locale) })}
            </span>
          </span>
        </span>
        <StateBadge state={last.state} />
        <span data-testid="statement-amount">
          <StatementAmount cents={headlineAmount} className="font-semibold whitespace-nowrap" />
        </span>
        <StatementAction statement={statement} />
      </div>
    );
  }

  return (
    <Card data-testid="credit-card" data-card={card.id} data-state={last.state}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <AccountMark account={card} className="size-6" />
          {card.name}
          <StateBadge state={last.state} />
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <CalendarClock aria-hidden="true" focusable="false" className="size-4" />
          {t("statementDue", { date: formatDate(headlineDue, locale) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">{headlineLabel}</span>
          <span data-testid="statement-amount">
            <StatementAmount cents={headlineAmount} className="text-3xl font-semibold" />
          </span>
        </div>
        <dl className="grid gap-1 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <dt className="text-muted-foreground">{t("lastStatement")}</dt>
            <dd className="flex items-center gap-1.5" data-testid="last-statement">
              {last.state === "paid" ? (
                t(STATE_KEYS[last.state])
              ) : (
                <StatementAmount cents={last.outstanding} />
              )}
              <span className="text-muted-foreground">
                · {t("dueShort", { date: formatDate(last.due, locale) })}
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <dt className="text-muted-foreground">{t("nextStatement")}</dt>
            <dd className="flex items-center gap-1.5" data-testid="next-statement">
              <Money cents={next.amount} />
              <span className="text-muted-foreground">
                · {t("dueShort", { date: formatDate(next.due, locale) })}
              </span>
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {t.rich("totalDebt", { amount: () => <Money cents={summary.totalDebt} /> })}
        </p>
        <div className="empty:hidden">
          <StatementAction statement={statement} />
        </div>
      </CardContent>
    </Card>
  );
}
