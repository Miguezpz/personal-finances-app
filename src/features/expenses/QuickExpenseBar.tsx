"use client";

/**
 * Row of quick expense buttons (spec 005, FR-006/FR-006a). One tap records the template's expense
 * for today; the "⋯" menu records it for yesterday or with another amount or date (FR-007a).
 *  - variant "dashboard": between the header and the bucket cards; without templates it shows a
 *    discreet link to create the first one (US2-6).
 *  - variant "dialog": on top of the new-expense dialog and in the mobile "＋" sheet (spec 008);
 *    nothing without templates. `onApplied` lets the dialog or sheet close itself.
 * The row scrolls on its own, so the page never scrolls sideways at 360 px (SC-005).
 */
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { lazy, Suspense, useState } from "react";
import { Money, useMoneyFormatter, useShouldMask } from "@/components/money/Money";
import { Button } from "@/components/ui/button";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { addDays } from "@/domain/dates";
import { taxonomyIconFor } from "@/domain/icons";
import { activeTemplates, templateAvailability } from "@/domain/quick-expenses";
import type { ExpenseTemplate, FinanceSnapshot } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { QuickExpenseMenuTrigger } from "./QuickExpenseMenuTrigger";
import { useQuickExpense } from "./quick-expense-hooks";

// The Radix menu and the "another amount or date" dialog load in their own chunks (the menu right
// after the row appears, the dialog on demand), keeping the Dashboard's First Load JS within the
// plan's budget. The bar only renders on the client, once the snapshot is loaded.
const QuickExpenseMenu = lazy(() => import("./QuickExpenseMenu"));
// The full taxonomy icon set is ~10 KB gzip; the icon is decorative, so it can arrive a moment later.
const CategoryIcon = lazy(() =>
  import("@/components/icons/CategoryIcon").then((m) => ({ default: m.CategoryIcon })),
);
const QuickExpenseCustomDialog = lazy(() =>
  import("./QuickExpenseCustomDialog").then((m) => ({ default: m.QuickExpenseCustomDialog })),
);

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
          <Link href="/settings/quick-expenses" data-testid="quick-expense-create-first">
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
                <Suspense fallback={<span aria-hidden="true" className="size-4 shrink-0" />}>
                  <CategoryIcon icon={taxonomyIconFor(template.subcategoryId, data)} />
                </Suspense>
                <span className="max-w-40 truncate">{template.name}</span>
                <Money cents={template.amount} className="font-semibold" />
                {disabled && <span className="sr-only">{t("unavailableSubcategory")}</span>}
              </Button>
              <Suspense
                fallback={
                  <QuickExpenseMenuTrigger
                    templateId={template.id}
                    label={t("moreOptions", { name: template.name })}
                    disabled
                  />
                }
              >
                <QuickExpenseMenu
                  templateId={template.id}
                  label={t("moreOptions", { name: template.name })}
                  disabled={disabled}
                  yesterdayLabel={t("yesterday")}
                  customizeLabel={t("customize")}
                  onYesterday={() => record(template, { spentOn: addDays(today, -1) })}
                  onCustomize={() => setCustom(template)}
                />
              </Suspense>
            </li>
          );
        })}
      </ul>

      {custom && (
        <Suspense fallback={null}>
          <QuickExpenseCustomDialog
            template={custom}
            open
            onOpenChange={(open) => {
              if (!open) setCustom(null);
            }}
            onApplied={onApplied}
          />
        </Suspense>
      )}
    </>
  );
}
