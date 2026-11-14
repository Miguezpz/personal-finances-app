"use client";

/**
 * Delete with Undo instead of a confirmation (spec 009, US2, FR-009–FR-013, research.md R3).
 *
 *  1. The read-only demo and "offline" are refused first, with their usual toast: the row never
 *     disappears (FR-013).
 *  2. Otherwise the row is hidden at once (pending-deletes → every snapshot selector) and a 6 s
 *     toast offers "Undo", which just drops the pending entry — the server is never called.
 *  3. When the toast's time is up — or the page is hidden/closed (`pagehide`), whichever is first —
 *     the delete is committed: the optimistic change goes into the cache, the provider deletes, and
 *     a failure rolls the cache back and says so (FR-011).
 * Timers live at module level, so navigating inside the app doesn't cancel a pending delete.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { useCanWrite, useDataProvider } from "@/data/context";
import type { DataProvider } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { updateSnapshot } from "@/data/snapshot-cache";
import type { FinanceSnapshot, Uuid } from "@/domain/types";
import { withoutIncome } from "@/features/income/hooks";
import { isBrowserOffline } from "@/lib/network";
import { notifyDemoReadOnly, notifyOffline } from "@/lib/demo-notice";
import { usePendingDeletes } from "@/store/pending-deletes";
import { UNDO_TOAST_MS } from "@/features/expenses/quick-expense-hooks";

export type DeletableKind = "expense" | "income" | "recurring" | "goal";

interface Spec {
  remove: (provider: DataProvider, id: Uuid) => Promise<void>;
  apply: (s: FinanceSnapshot, id: Uuid) => FinanceSnapshot;
}

const SPECS: Record<DeletableKind, Spec> = {
  expense: {
    remove: (p, id) => p.expenses.remove(id),
    apply: (s, id) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }),
  },
  income: {
    remove: (p, id) => p.incomes.remove(id),
    apply: (s, id) => withoutIncome(s, id),
  },
  recurring: {
    remove: (p, id) => p.recurring.remove(id),
    apply: (s, id) => ({
      ...s,
      recurring: s.recurring.filter((r) => r.id !== id),
      expenses: s.expenses.map((e) =>
        e.recurringExpenseId === id ? { ...e, recurringExpenseId: null } : e,
      ),
    }),
  },
  // Spec 014 FR-014: its Saved moves go with it (FK cascade), so "Available to assign" goes up.
  goal: {
    remove: (p, id) => p.goals.remove(id),
    apply: (s, id) => ({
      ...s,
      goals: s.goals.filter((g) => g.id !== id),
      contributions: s.contributions.filter((c) => c.goalId !== id),
      savedMoves: s.savedMoves.filter((m) => m.goalId !== id),
    }),
  },
};

interface Scheduled {
  timer: ReturnType<typeof setTimeout>;
  commit: () => void;
}
const scheduled = new Map<string, Scheduled>();
const leavingTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** How long a deleted row fades out before it's hidden (spec 010, FR-005). */
export const ROW_EXIT_MS = 180;
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
let pagehideBound = false;

function bindPagehide() {
  if (pagehideBound || typeof window === "undefined") return;
  pagehideBound = true;
  window.addEventListener("pagehide", () => {
    for (const { commit } of [...scheduled.values()]) commit();
  });
}

/** Commits every pending delete now (tests; also what `pagehide` does). */
export function flushPendingDeletes(): void {
  for (const { commit } of [...scheduled.values()]) commit();
}

async function commitDelete(
  queryClient: QueryClient,
  provider: DataProvider,
  kind: DeletableKind,
  id: Uuid,
  onFailed: () => void,
) {
  const spec = SPECS[kind];
  const rollback = await updateSnapshot(queryClient, (s) => spec.apply(s, id));
  usePendingDeletes.getState().remove(`${kind}:${id}`);
  try {
    await spec.remove(provider, id);
  } catch {
    rollback();
    onFailed();
  } finally {
    void queryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
  }
}

export function useDeferredDelete(): {
  remove: (input: { kind: DeletableKind; id: Uuid; label: string }) => void;
} {
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const provider = useDataProvider();
  const canWrite = useCanWrite();

  const remove = useCallback(
    ({ kind, id, label }: { kind: DeletableKind; id: Uuid; label: string }) => {
      if (!canWrite) {
        notifyDemoReadOnly();
        return;
      }
      if (isBrowserOffline()) {
        notifyOffline();
        return;
      }
      bindPagehide();
      const key = `${kind}:${id}`;
      const spec = SPECS[kind];
      const hide = () => {
        usePendingDeletes.getState().clearLeaving(key);
        usePendingDeletes.getState().add({ key, apply: (s) => spec.apply(s, id) });
      };
      // Spec 010 (FR-005): the row fades out first, then it's hidden (at once under reduced motion).
      if (prefersReducedMotion()) hide();
      else {
        usePendingDeletes.getState().markLeaving(key);
        leavingTimers.set(key, setTimeout(hide, ROW_EXIT_MS));
      }

      const commit = () => {
        const entry = scheduled.get(key);
        if (!entry) return;
        clearTimeout(entry.timer);
        scheduled.delete(key);
        const exit = leavingTimers.get(key);
        if (exit !== undefined) {
          clearTimeout(exit);
          leavingTimers.delete(key);
          usePendingDeletes.getState().clearLeaving(key);
        }
        void commitDelete(queryClient, provider, kind, id, () => toast.error(tc("deleteFailed")));
      };
      scheduled.set(key, { timer: setTimeout(commit, UNDO_TOAST_MS), commit });

      const toastId: string | number = toast(label, {
        duration: UNDO_TOAST_MS,
        action: {
          label: tc("undo"),
          onClick: () => {
            const entry = scheduled.get(key);
            if (!entry) return; // already committed
            clearTimeout(entry.timer);
            scheduled.delete(key);
            clearTimeout(leavingTimers.get(key));
            leavingTimers.delete(key);
            usePendingDeletes.getState().clearLeaving(key);
            usePendingDeletes.getState().remove(key);
            toast.dismiss(toastId);
          },
        },
      });
    },
    [canWrite, queryClient, provider, tc],
  );

  return { remove };
}
