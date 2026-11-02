"use client";

/**
 * Debt per credit card (T164, US4-4/5, FR-029): total debt (including the full balance of MSI for
 * third parties), the "pay to avoid interest" amount as the headline — never the minimum payment —
 * and its due date. A purchase with the card raises it; a card payment lowers it.
 */
import { CreditCard, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Money } from "@/components/money/Money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { cardStatus, type CardStatus } from "@/domain/credit";
import type { Account, Cents, FinanceSnapshot, Uuid } from "@/domain/types";
import { formatDate } from "@/i18n/format";
import { useToday } from "@/lib/use-today";
import { selectLocale, usePreferences } from "@/store/preferences";

const selectCards = (s: FinanceSnapshot) => s;

export function useCardStatuses(): { card: Account; status: CardStatus }[] | undefined {
  const today = useToday();
  const { data } = useFinanceSnapshot(selectCards);
  return useMemo(
    () =>
      data?.accounts
        .filter((a) => a.kind === "credit_card" && !a.archived)
        .map((card) => ({ card, status: cardStatus(card, data, today) })),
    [data, today],
  );
}

export function CardDebtSummary({ onPay }: { onPay: (cardId: Uuid, amount: Cents) => void }) {
  const t = useTranslations("expenses");
  const locale = usePreferences(selectLocale);
  const cards = useCardStatuses();

  if (!cards || cards.length === 0) return null;

  return (
    <section aria-labelledby="card-debt" className="flex flex-col gap-3">
      <h2 id="card-debt" className="text-lg font-semibold tracking-tight">
        {t("cardsTitle")}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {cards.map(({ card, status }) => (
          <li key={card.id}>
            <Card data-testid="card-debt" data-card={card.id} data-overdue={status.overdue}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard aria-hidden="true" className="size-4 text-muted-foreground" />
                  {card.name}
                </CardTitle>
                {status.overdue && (
                  <Badge variant="destructive" className="gap-1">
                    <TriangleAlert aria-hidden="true" />
                    {t("overdue")}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">{t("payToAvoidInterest")}</span>
                  <Money cents={status.payToAvoidInterest} className="text-2xl font-semibold" />
                  <span className="text-sm text-muted-foreground">
                    {t("dueOn", { date: formatDate(status.nextPaymentDue, locale) })} ·{" "}
                    {t("cutOffOn", { date: formatDate(status.lastCutOff, locale) })}
                  </span>
                </div>
                <div
                  className="flex items-center justify-between gap-4 text-sm"
                  data-testid="card-total-debt"
                >
                  <span>{t("totalDebt")}</span>
                  <Money cents={status.totalDebt} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => onPay(card.id, status.payToAvoidInterest)}
                  data-testid="pay-card"
                >
                  {t("payCard")}
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
