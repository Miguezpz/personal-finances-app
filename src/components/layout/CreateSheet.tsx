"use client";

/**
 * Mobile "＋" sheet (spec 008, US2, FR-007/FR-008): the create actions (expense, income) as large
 * buttons, then the owner's quick expenses. Each action closes the sheet and opens the app's single
 * instance of that dialog (DialogHost).
 */
import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { lazy, Suspense } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { CREATE_ACTIONS } from "./create-actions";

// Only needed once the sheet opens: its own chunk keeps it out of every route's First Load JS.
const QuickExpenseBar = lazy(() =>
  import("@/features/expenses/QuickExpenseBar").then((m) => ({ default: m.QuickExpenseBar })),
);

export function CreateSheet() {
  const t = useTranslations("create");
  const open = useUi((s) => s.createSheetOpen);
  const setOpen = useUi((s) => s.setCreateSheetOpen);
  const openCreate = useUi((s) => s.openCreate);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-3 overflow-y-auto rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        data-testid="create-sheet"
      >
        <SheetHeader className="p-0">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("title")}</SheetDescription>
        </SheetHeader>
        <ul className="grid grid-cols-2 gap-2">
          {CREATE_ACTIONS.map(({ kind, labelKey, icon: Icon, testId }) => {
            return (
              <li key={kind} className="min-w-0">
                <button
                  type="button"
                  data-testid={`create-${testId}`}
                  onClick={() => openCreate({ kind })}
                  className={cn(
                    "flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium transition-colors duration-fast",
                    "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="max-w-full truncate">{t(labelKey)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {open && (
          <Suspense fallback={null}>
            <QuickExpenseBar onApplied={() => setOpen(false)} />
          </Suspense>
        )}
        {/* Spec 009 (FR-029): template management lives in Settings. */}
        <Link
          href="/settings/quick-expenses"
          onClick={() => setOpen(false)}
          className="inline-flex w-fit items-center gap-1 self-end rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:min-h-11"
          data-testid="create-manage-quick"
        >
          <Settings2 aria-hidden="true" className="size-4" />
          {t("manageQuick")}
        </Link>
      </SheetContent>
    </Sheet>
  );
}
