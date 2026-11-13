"use client";

/**
 * Saved (spec 013): what the previous quincena left over and the total so far. It is not part of
 * what you can spend, so it sits below the bucket cards.
 * Spec 014: "Available to assign" = total − what's in goals (never shown below $0, with a notice
 * when goals hold more than what's saved) and an Assign button to send it to a goal.
 */
import { CircleAlert, PiggyBank } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Money } from "@/components/money/Money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { availableToAssign } from "@/domain/goals";
import type { SavedSummary } from "@/domain/safe-to-spend";
import type { Cents } from "@/domain/types";
import { useGoalData } from "@/features/goals/hooks";
import { SavedMoveDialog } from "@/features/goals/SavedMoveDialog";

export function SavedCard({ saved }: { saved: SavedSummary }) {
  const t = useTranslations("dashboard");
  const { data } = useGoalData();
  const [assigning, setAssigning] = useState(false);
  const { available, over } = availableToAssign(saved.total, data?.savedMoves ?? []);
  const shown = Math.max(available, 0) as Cents;
  const activeGoals = (data?.goals ?? []).filter((g) => !g.archived);

  return (
    <Card data-testid="saved-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
          <PiggyBank className="size-4" aria-hidden="true" />
          {t("savedTitle")}
        </CardTitle>
        <CardDescription>{t("savedHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-4" data-testid="saved-last">
            <dt>{t("savedLastPeriod")}</dt>
            <dd>
              <Money cents={saved.lastPeriod} />
            </dd>
          </div>
          <div className="flex justify-between gap-4" data-testid="saved-total">
            <dt>{t("savedTotal")}</dt>
            <dd>
              <Money cents={saved.total} />
            </dd>
          </div>
          <div className="flex justify-between gap-4 font-medium" data-testid="saved-available">
            <dt>{t("savedAvailable")}</dt>
            <dd>
              <Money cents={shown} />
            </dd>
          </div>
        </dl>
        {over && (
          <Alert data-testid="saved-over">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{t("savedOver")}</AlertDescription>
          </Alert>
        )}
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={shown <= 0 || activeGoals.length === 0}
          onClick={() => setAssigning(true)}
          data-testid="saved-assign"
        >
          {t("savedAssign")}
        </Button>
        {activeGoals.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("savedNoGoals")}</p>
        )}
      </CardContent>
      {assigning && (
        <SavedMoveDialog
          open={assigning}
          onOpenChange={setAssigning}
          mode="assign"
          goal={null}
          goals={activeGoals}
          max={shown}
        />
      )}
    </Card>
  );
}
