"use client";

/**
 * Quick expense hooks (spec 005, contracts/ui-components.md).
 *
 * `useQuickExpense().apply` registers the template's expense through the existing optimistic
 * `useCreateExpense()`, so the Safe-to-Spend drops the instant it's tapped and rolls back if the
 * write fails (FR-008). The toast's Undo waits for THAT creation's promise and deletes the server
 * row by its real id, never the optimistic one (research R5); each tap keeps its own promise, so an
 * Undo only removes its own expense (FR-009, FR-010).
 *
 * Template management hooks are optimistic writes over the same snapshot.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { useCanWrite } from "@/data/context";
import { isNotifiedGlobally } from "@/data/errors";
import type { NewEntity, Patch } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { templateToExpense, type QuickExpenseOverrides } from "@/domain/quick-expenses";
import type { Expense, ExpenseTemplate, FinanceSnapshot, Uuid } from "@/domain/types";
import { useToday } from "@/lib/use-today";
import { useCreateExpense, useDeleteExpense } from "./hooks";

/** How long the confirmation (and its Undo) stays on screen; FR-009 asks for at least 5 s. */
export const UNDO_TOAST_MS = 6000;

const selectTemplates = (s: FinanceSnapshot) => s.expenseTemplates;

export function useExpenseTemplates() {
  return useFinanceSnapshot(selectTemplates);
}

export function useQuickExpense(): {
  apply: (template: ExpenseTemplate, overrides?: QuickExpenseOverrides) => void;
} {
  const t = useTranslations("quickExpenses");
  const today = useToday();
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const { mutateAsync: createExpense } = useCreateExpense();
  const { mutateAsync: deleteExpense } = useDeleteExpense();

  const apply = useCallback(
    (template: ExpenseTemplate, overrides?: QuickExpenseOverrides) => {
      const snapshot = queryClient.getQueryData<FinanceSnapshot>(queryKeys.snapshot);
      if (!snapshot) return;
      const input = templateToExpense(template, snapshot, today, overrides);
      if (!input) return;

      let toastId: string | number | undefined;
      const creation: Promise<Expense | null> = createExpense(input).then(
        (row) => row,
        (e: unknown) => {
          toast.dismiss(toastId);
          if (!isNotifiedGlobally(e)) toast.error(t("addFailed"));
          return null;
        },
      );

      // The demo rejects every write with its own global toast: no "recorded" message there.
      if (canWrite) {
        toastId = toast.success(t("added", { name: template.name }), {
          duration: UNDO_TOAST_MS,
          action: {
            label: t("undo"),
            onClick: () => {
              void creation.then(async (row) => {
                if (!row) return; // the creation failed and was already rolled back
                try {
                  await deleteExpense(row.id);
                  toast(t("undone"));
                } catch (e) {
                  if (!isNotifiedGlobally(e)) toast.error(t("undoFailed"));
                }
              });
            },
          },
        });
      }
    },
    [queryClient, today, canWrite, createExpense, deleteExpense, t],
  );

  return { apply };
}

// ---------------------------------------------------------------------------
// Template management (US2)
// ---------------------------------------------------------------------------
const patchTemplate = (
  s: FinanceSnapshot,
  id: Uuid,
  patch: Patch<ExpenseTemplate>,
): FinanceSnapshot => ({
  ...s,
  expenseTemplates: s.expenseTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
});

export function useCreateTemplate() {
  return useSnapshotMutation<NewEntity<ExpenseTemplate>, ExpenseTemplate>({
    mutationFn: (provider, input) => provider.expenseTemplates.create(input),
    optimistic: (s, input, { tempId }) => ({
      ...s,
      expenseTemplates: [...s.expenseTemplates, { ...input, id: tempId }],
    }),
    created: (s, row, { tempId }) => ({
      ...s,
      expenseTemplates: replaceTemp(s.expenseTemplates, tempId, row),
    }),
  });
}

export function useUpdateTemplate() {
  return useSnapshotMutation<{ id: Uuid; patch: Patch<ExpenseTemplate> }, ExpenseTemplate>({
    mutationFn: (provider, { id, patch }) => provider.expenseTemplates.update(id, patch),
    optimistic: (s, { id, patch }) => patchTemplate(s, id, patch),
  });
}

/** Logical delete: the template is archived; expenses recorded with it never change (FR-002). */
export function useRemoveTemplate() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.expenseTemplates.remove(id),
    optimistic: (s, id) => patchTemplate(s, id, { archived: true }),
  });
}

/** `ids` in the new order: each template gets sort = its index. */
export function useReorderTemplates() {
  return useSnapshotMutation<readonly Uuid[], void>({
    mutationFn: (provider, ids) => provider.expenseTemplates.reorder(ids),
    optimistic: (s, ids) => ({
      ...s,
      expenseTemplates: s.expenseTemplates.map((t) =>
        ids.includes(t.id) ? { ...t, sort: ids.indexOf(t.id) } : t,
      ),
    }),
  });
}
