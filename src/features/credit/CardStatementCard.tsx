"use client";

/**
 * A card's statements (spec 008, US3; spec 011): the last one (paid / pending / overdue) and the
 * next one, with "Ya la pagué" — or "Desmarcar" when the last one carries its own mark. The
 * headline is the last statement until it's marked as paid, then the next one. Shown only on
 * Credit.
 */
import { CalendarClock, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { AccountMark } from "@/components/icons/AccountMark";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatementState } from "@/domain/credit";
import type { Cents, IsoDate } from "@/domain/types";
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
 * may still have the family's purchases, so it's a fact, not "nothing to pay". `compact` uses the
 * short label ("No purchases") and inherits the surrounding size and color, for phone rows.
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

export function CardStatementCard({ statement }: { statement: CardStatement }) {
  const t = useTranslations("credit");
  const locale = usePreferences(selectLocale);
  const { card, summary } = statement;
  const { last, next, headline } = summary;
  const headlineDue = headline === "last" ? last.due : next.due;
  const headlineAmount = headline === "last" ? last.outstanding : next.amount;
  const headlineLabel = headline === "last" ? t("payToAvoidInterest") : t("nextStatement");
  const short = (date: IsoDate) => formatDate(date, locale, "short");

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
          <span data-testid="statement-amount" data-cents={headlineAmount}>
            <StatementAmount cents={headlineAmount} className="text-3xl font-semibold" />
          </span>
        </div>
        {/* Three aligned columns — label · amount · due date — short dates and "No purchases", so
            each row fits a phone line (spec 008 FR-019 layout, revisited). */}
        <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 gap-y-1 text-sm">
          <div className="col-span-3 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{t("lastStatement")}</dt>
            <dd className="col-span-2 grid grid-cols-subgrid" data-testid="last-statement">
              <span className="text-right whitespace-nowrap">
                {last.state === "paid" ? (
                  t(STATE_KEYS[last.state])
                ) : (
                  <StatementAmount cents={last.outstanding} compact />
                )}
              </span>
              <span className="text-right whitespace-nowrap text-muted-foreground">
                {t("dueShort", { date: short(last.due) })}
              </span>
            </dd>
          </div>
          <div className="col-span-3 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{t("nextStatement")}</dt>
            <dd className="col-span-2 grid grid-cols-subgrid" data-testid="next-statement">
              <Money cents={next.amount} className="text-right whitespace-nowrap" />
              <span className="text-right whitespace-nowrap text-muted-foreground">
                {t("dueShort", { date: short(next.due) })}
              </span>
            </dd>
          </div>
          <div className="col-span-3 flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t("totalDebtShort")}</dt>
            <dd className="text-right whitespace-nowrap" data-testid="total-debt">
              <Money cents={summary.totalDebt} />
            </dd>
          </div>
        </dl>
        <div className="empty:hidden">
          <StatementAction statement={statement} />
        </div>
      </CardContent>
    </Card>
  );
}
