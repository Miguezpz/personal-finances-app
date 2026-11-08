"use client";

/**
 * The single instance of each create/edit dialog (spec 008, FR-009, contracts/ui-shell.md).
 * Any screen opens one through useUi.openCreate; the `key` remounts the form per entity so it
 * starts from that entity's values. A route change closes it, so the browser's Back never leaves
 * a dialog from another page on screen.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  LazyAddExpenseDialog,
  usePreloadAddExpenseDialog,
} from "@/features/expenses/LazyAddExpenseDialog";
import { LazyAddReceivableDialog } from "@/features/receivables/LazyAddReceivableDialog";
import {
  LazyRegisterIncomeDialog,
  usePreloadRegisterIncomeDialog,
} from "@/features/income/LazyRegisterIncomeDialog";
import { useUi } from "@/store/ui";

function useCloseOnNavigation() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const ui = useUi.getState();
    if (ui.activeDialog) ui.closeDialog();
    if (ui.createSheetOpen) ui.setCreateSheetOpen(false);
  }, [pathname]);
}

export function DialogHost() {
  const dialog = useUi((s) => s.activeDialog);
  const closeDialog = useUi((s) => s.closeDialog);
  usePreloadAddExpenseDialog();
  usePreloadRegisterIncomeDialog();
  useCloseOnNavigation();

  const onOpenChange = (open: boolean) => {
    if (!open) closeDialog();
  };

  switch (dialog?.kind) {
    case "expense":
      return (
        <LazyAddExpenseDialog
          key={`${dialog.expense?.id ?? "new"}-${dialog.draft ? "draft" : ""}`}
          open
          expense={dialog.expense ?? null}
          {...(dialog.draft ? { draft: dialog.draft } : {})}
          onOpenChange={onOpenChange}
        />
      );
    case "income":
      return (
        <LazyRegisterIncomeDialog
          key={`${dialog.income?.id ?? "new"}-${dialog.draft ? "draft" : ""}`}
          open
          income={dialog.income ?? null}
          {...(dialog.draft ? { draft: dialog.draft } : {})}
          onOpenChange={onOpenChange}
        />
      );
    case "receivable":
      return (
        <LazyAddReceivableDialog
          open
          {...(dialog.draft ? { draft: dialog.draft } : {})}
          onOpenChange={onOpenChange}
        />
      );
    default:
      return null;
  }
}
