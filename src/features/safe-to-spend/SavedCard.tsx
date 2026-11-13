"use client";

/**
 * Saved (spec 013): what the previous quincena left over and the total so far. View only — it is
 * not part of what you can spend, so it sits below the bucket cards.
 */
import { PiggyBank } from "lucide-react";
import { useTranslations } from "next-intl";
import { Money } from "@/components/money/Money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SavedSummary } from "@/domain/safe-to-spend";

export function SavedCard({ saved }: { saved: SavedSummary }) {
  const t = useTranslations("dashboard");
  return (
    <Card data-testid="saved-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <PiggyBank className="size-4" aria-hidden="true" />
          {t("savedTitle")}
        </CardTitle>
        <CardDescription>{t("savedHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-4" data-testid="saved-last">
            <dt>{t("savedLastPeriod")}</dt>
            <dd>
              <Money cents={saved.lastPeriod} />
            </dd>
          </div>
          <div className="flex justify-between gap-4 font-medium" data-testid="saved-total">
            <dt>{t("savedTotal")}</dt>
            <dd>
              <Money cents={saved.total} />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
