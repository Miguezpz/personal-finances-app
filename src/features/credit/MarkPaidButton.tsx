"use client";

/**
 * "Ya la pagué" and "Desmarcar" (spec 011, contracts/ui.md): one tap, no form. Shared by the card
 * statements (Credit, Expenses), the Dashboard alerts and the payment session. 44 px touch target
 * and an accessible name with the card (FR-024).
 */
import { CircleCheck, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Account, IsoDate, StatementMark } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useStatementMarkActions } from "./use-statement-marks";

export function MarkPaidButton({
  card,
  cutOff,
  className,
}: {
  card: Pick<Account, "id" | "name">;
  cutOff: IsoDate;
  className?: string;
}) {
  const t = useTranslations("credit");
  const { mark } = useStatementMarkActions();
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("pointer-coarse:min-h-11", className)}
      data-testid="mark-paid"
      data-card={card.id}
      aria-label={t("markPaidFor", { card: card.name })}
      onClick={() => mark(card, cutOff)}
    >
      <CircleCheck aria-hidden="true" />
      {t("markPaid")}
    </Button>
  );
}

export function UnmarkButton({
  card,
  mark,
  className,
}: {
  card: Pick<Account, "id" | "name">;
  mark: Pick<StatementMark, "id" | "cutOff">;
  className?: string;
}) {
  const t = useTranslations("credit");
  const { unmark } = useStatementMarkActions();
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("text-muted-foreground pointer-coarse:min-h-11", className)}
      data-testid="unmark-paid"
      data-card={card.id}
      aria-label={t("unmarkFor", { card: card.name })}
      onClick={() => unmark(card, mark)}
    >
      <Undo2 aria-hidden="true" />
      {t("unmark")}
    </Button>
  );
}
