"use client";

/**
 * Row of quick expense buttons (spec 005, FR-006/FR-006a). One tap records the template's expense
 * for today; the "⋯" menu records it for yesterday or with another amount or date (FR-007a).
 *  - variant "dashboard": between the header and the bucket cards; without templates it shows a
 *    discreet link to create the first one (US2-6).
 *  - variant "dialog": on top of the new-expense dialog (which the mobile floating button opens on
 *    every page); nothing without templates. `onApplied` lets the dialog close itself.
 * The row scrolls on its own, so the page never scrolls sideways at 360 px (SC-005).
 */
import { MoreHorizontal, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { Money, useMoneyFormatter, useShouldMask } from "@/components/money/Money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { addDays } from "@/domain/dates";
import { taxonomyIconFor } from "@/domain/icons";
import { activeTemplates, templateAvailability } from "@/domain/quick-expenses";
import type { ExpenseTemplate, FinanceSnapshot } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { QuickExpenseCustomDialog } from "./QuickExpenseCustomDialog";
import { useQuickExpense } from "./quick-expense-hooks";

const selectBarData = (s: FinanceSnapshot) => ({
  templates: activeTemplates(s.expenseTemplates),
  categories: s.categories,
  subcategories: s.subcategories,
  accounts: s.accounts,
});

interface Props {
  variant: "dashboard" | "dialog";
  /** Called after recording; the expense dialog uses it to close. */
  onApplied?: (() => void) | undefined;
}

export function QuickExpenseBar({ variant, onApplied }: Props) {
  const t = useTranslations("quickExpenses");
  const tc = useTranslations("common");
  const today = useToday();
  const { data } = useFinanceSnapshot(selectBarData);
  const { apply } = useQuickExpense();
  const format = useMoneyFormatter();
  const masked = useShouldMask();
  const [custom, setCustom] = useState<ExpenseTemplate | null>(null);

  if (!data) return null;
  if (data.templates.length === 0) {
    if (variant === "dialog") return null;
    return (
      <div>
        <Button asChild variant="link" size="sm" className="h-auto px-0">
          <Link href="/expenses#quick-expenses" data-testid="quick-expense-create-first">
            <Plus aria-hidden="true" />
            {t("createFirst")}
          </Link>
        </Button>
      </div>
    );
  }

  const record = (template: ExpenseTemplate, overrides?: Parameters<typeof apply>[1]) => {
    apply(template, overrides);
    onApplied?.();
  };

  return (
    <>
      <ul
        role="list"
        aria-label={t("title")}
        data-testid="quick-expense-bar"
        className="-mx-1 flex max-w-full min-w-0 gap-2 overflow-x-auto px-1 py-1"
      >
        {data.templates.map((template) => {
          const availability = templateAvailability(template, data);
          const disabled = !availability.usable;
          const amount = masked ? tc("hiddenAmount") : format(template.amount);
          return (
            <li
              key={template.id}
              className="flex shrink-0"
              title={disabled ? t("unavailableSubcategory") : undefined}
            >
              <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-2 rounded-r-none px-3"
                disabled={disabled}
                aria-label={t("apply", { name: template.name, amount })}
                data-testid={`quick-expense-${template.id}`}
                onClick={() => record(template)}
              >
                <CategoryIcon icon={taxonomyIconFor(template.subcategoryId, data)} />
                <span className="max-w-40 truncate">{template.name}</span>
                <Money cents={template.amount} className="font-semibold" />
                {disabled && <span className="sr-only">{t("unavailableSubcategory")}</span>}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-9 rounded-l-none border-l-0 px-0"
                    disabled={disabled}
                    aria-label={t("moreOptions", { name: template.name })}
                    data-testid={`quick-expense-menu-${template.id}`}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    data-testid="quick-expense-yesterday"
                    onSelect={() => record(template, { spentOn: addDays(today, -1) })}
                  >
                    {t("yesterday")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="quick-expense-customize"
                    onSelect={() => setCustom(template)}
                  >
                    {t("customize")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      {custom && (
        <QuickExpenseCustomDialog
          template={custom}
          open
          onOpenChange={(open) => {
            if (!open) setCustom(null);
          }}
          onApplied={onApplied}
        />
      )}
    </>
  );
}
