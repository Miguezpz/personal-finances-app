"use client";

/**
 * "Quick expenses" on the Expenses page (spec 005, US2): the active templates in the Dashboard's
 * order, with edit, move up/down and delete (with confirmation). Up to 12 (FR-005). A template
 * whose subcategory is archived is flagged unavailable (FR-011); one whose payment method is
 * archived says it's recorded without one. `#quick-expenses` is the Dashboard's "create" anchor.
 */
import { ArrowDown, ArrowUp, CircleAlert, Ellipsis, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { Money } from "@/components/money/Money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { isNotifiedGlobally } from "@/data/errors";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { taxonomyIconFor } from "@/domain/icons";
import {
  activeTemplates,
  canAddTemplate,
  reorderIds,
  templateAvailability,
} from "@/domain/quick-expenses";
import type { ExpenseTemplate, FinanceSnapshot, Uuid } from "@/domain/types";
import { useTaxonomyName } from "@/features/settings/taxonomy/useTaxonomyName";
import { QuickExpenseTemplateDialog } from "./QuickExpenseTemplateDialog";
import { useRemoveTemplate, useReorderTemplates } from "./quick-expense-hooks";

const selectSectionData = (s: FinanceSnapshot) => ({
  templates: activeTemplates(s.expenseTemplates),
  canAdd: canAddTemplate(s.expenseTemplates),
  categories: s.categories,
  subcategories: s.subcategories,
  accounts: s.accounts,
});

export function QuickExpensesSection() {
  const t = useTranslations("quickExpenses");
  const tc = useTranslations("common");
  const nameOf = useTaxonomyName();
  const { data } = useFinanceSnapshot(selectSectionData);
  const removeTemplate = useRemoveTemplate();
  const reorderTemplates = useReorderTemplates();
  const [editing, setEditing] = useState<{ open: boolean; template: ExpenseTemplate | null }>({
    open: false,
    template: null,
  });
  const [toDelete, setToDelete] = useState<ExpenseTemplate | null>(null);

  if (!data) return null;
  const { templates } = data;
  const ids = templates.map((x) => x.id);

  const onError = (e: Error) => {
    if (!isNotifiedGlobally(e)) toast.error(t("saveFailed"));
  };
  const move = (id: Uuid, direction: "up" | "down") =>
    reorderTemplates.mutate(reorderIds(ids, id, direction), { onError });

  function confirmDelete() {
    if (!toDelete) return;
    removeTemplate.mutate(toDelete.id, {
      onSuccess: () => toast.success(t("deleted")),
      onError,
    });
    setToDelete(null);
  }

  const subName = (id: Uuid) => {
    const sub = data.subcategories.find((x) => x.id === id);
    return sub ? nameOf(sub) : "";
  };
  const accountName = (id: Uuid | null) =>
    data.accounts.find((a) => a.id === id && !a.archived)?.name ?? null;

  return (
    <section
      id="quick-expenses"
      aria-labelledby="quick-expenses-title"
      className="flex scroll-mt-20 flex-col gap-3"
      data-testid="quick-expenses-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="quick-expenses-title" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setEditing({ open: true, template: null })}
          disabled={!data.canAdd}
          aria-describedby={data.canAdd ? undefined : "quick-expenses-limit"}
          data-testid="create-template"
        >
          <Plus aria-hidden="true" />
          {t("create")}
        </Button>
      </div>
      {!data.canAdd && (
        <p id="quick-expenses-limit" className="text-sm text-muted-foreground">
          {t("limitReached")}
        </p>
      )}

      {templates.length === 0 ? (
        <EmptyState icon={Zap}>{t("empty")}</EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="template-list">
          {templates.map((template, index) => {
            const availability = templateAvailability(template, data);
            const account = accountName(template.paymentAccountId);
            return (
              <li
                key={template.id}
                data-testid="template-row"
                data-template={template.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-sm"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{template.name}</span>
                    <Money cents={template.amount} className="font-medium whitespace-nowrap" />
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <CategoryIcon
                      icon={taxonomyIconFor(template.subcategoryId, data)}
                      className="size-3.5"
                    />
                    {subName(template.subcategoryId)}
                    {account && <> · {account}</>}
                  </span>
                  {!availability.usable && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                      {t("unavailableSubcategory")}
                    </span>
                  )}
                  {availability.usable && availability.accountDropped && (
                    <span className="mt-1 text-xs text-muted-foreground">
                      {t("accountArchived")}
                    </span>
                  )}
                </span>
                {/* Spec 009 (FR-017): the row's actions in one "⋯" menu. */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("actionsFor", { name: template.name })}
                      data-testid="template-menu"
                    >
                      <Ellipsis aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={index === 0}
                      onSelect={() => move(template.id, "up")}
                      data-testid="template-up"
                    >
                      <ArrowUp aria-hidden="true" />
                      {t("moveUp", { name: template.name })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={index === templates.length - 1}
                      onSelect={() => move(template.id, "down")}
                      data-testid="template-down"
                    >
                      <ArrowDown aria-hidden="true" />
                      {t("moveDown", { name: template.name })}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setEditing({ open: true, template })}
                      data-testid="template-edit"
                    >
                      <Pencil aria-hidden="true" />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setToDelete(template)}
                      data-testid="template-delete"
                    >
                      <Trash2 aria-hidden="true" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      {editing.open && (
        <QuickExpenseTemplateDialog
          key={editing.template?.id ?? "new"}
          open={editing.open}
          template={editing.template}
          onOpenChange={(open) => setEditing((d) => ({ ...d, open }))}
        />
      )}

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirm")}</DialogTitle>
            <DialogDescription>{t("deleteHint")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              data-testid="confirm-delete-template"
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
