"use client";

/**
 * Credit cards on Expenses (spec 008, US3, FR-023): one compact row per card — the same statement
 * summary as Credit (state, headline amount and date, "Pay") — and a link to Credit for the rest.
 */
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CardStatementCard } from "@/features/credit/CardStatementCard";
import { useCardStatements } from "@/features/credit/use-card-statements";

export function CardDebtSummary() {
  const t = useTranslations("expenses");
  const tc = useTranslations("credit");
  const cards = useCardStatements();

  if (!cards || cards.length === 0) return null;

  return (
    <section aria-labelledby="card-debt" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="card-debt" className="text-lg font-semibold tracking-tight">
          {t("cardsTitle")}
        </h2>
        <Link
          href="/credit"
          data-testid="cards-see-credit"
          className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11"
        >
          {tc("seeInCredit")}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ul className="divide-y rounded-lg border">
        {cards.map((statement) => (
          <li key={statement.card.id}>
            <CardStatementCard statement={statement} variant="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}
