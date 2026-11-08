"use client";

/**
 * "Ya la pagué" / "Desmarcar" (spec 011, US1/US2, research.md R7).
 *
 * One tap, no form: marking writes a statement mark through an optimistic snapshot mutation (so
 * every view flips to "paid" at once and rolls back if the write fails), then a 6 s toast offers
 * Undo, which waits for THAT write's promise and applies the opposite one (the pattern of
 * useQuickExpense). The read-only demo and "offline" are refused first, with their usual toast,
 * so nothing ever flickers.
 */
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { useCanWrite } from "@/data/context";
import { isNotifiedGlobally } from "@/data/errors";
import { replaceTemp, useSnapshotMutation } from "@/data/snapshot-cache";
import type { Account, IsoDate, StatementMark, Uuid } from "@/domain/types";
import { UNDO_TOAST_MS } from "@/features/expenses/quick-expense-hooks";
import { notifyDemoReadOnly, notifyOffline } from "@/lib/demo-notice";
import { isBrowserOffline } from "@/lib/network";

interface MarkInput {
  cardAccountId: Uuid;
  cutOff: IsoDate;
}

export function useMarkStatementPaid() {
  return useSnapshotMutation<MarkInput, StatementMark>({
    mutationFn: (provider, input) => provider.statementMarks.create(input),
    optimistic: (s, input, { tempId }) =>
      s.statementMarks.some(
        (m) => m.cardAccountId === input.cardAccountId && m.cutOff === input.cutOff,
      )
        ? s
        : { ...s, statementMarks: [...s.statementMarks, { ...input, id: tempId }] },
    created: (s, row, { tempId }) => ({
      ...s,
      statementMarks: s.statementMarks.some((m) => m.id === row.id)
        ? s.statementMarks.filter((m) => m.id !== tempId)
        : replaceTemp(s.statementMarks, tempId, row),
    }),
  });
}

export function useUnmarkStatement() {
  return useSnapshotMutation<Uuid, void>({
    mutationFn: (provider, id) => provider.statementMarks.remove(id),
    optimistic: (s, id) => ({ ...s, statementMarks: s.statementMarks.filter((m) => m.id !== id) }),
  });
}

/** Marking and unmarking with their toast and Undo; what every "Ya la pagué" button uses. */
export function useStatementMarkActions(): {
  mark: (card: Pick<Account, "id" | "name">, cutOff: IsoDate) => void;
  unmark: (card: Pick<Account, "id" | "name">, mark: Pick<StatementMark, "id" | "cutOff">) => void;
} {
  const t = useTranslations("credit");
  const tc = useTranslations("common");
  const canWrite = useCanWrite();
  const { mutateAsync: create } = useMarkStatementPaid();
  const { mutateAsync: remove } = useUnmarkStatement();

  const refused = useCallback(() => {
    if (!canWrite) {
      notifyDemoReadOnly();
      return true;
    }
    if (isBrowserOffline()) {
      notifyOffline();
      return true;
    }
    return false;
  }, [canWrite]);

  const failed = useCallback(
    (e: unknown) => {
      if (!isNotifiedGlobally(e)) toast.error(tc("saveFailedRetry"));
    },
    [tc],
  );

  const mark = useCallback(
    (card: Pick<Account, "id" | "name">, cutOff: IsoDate) => {
      if (refused()) return;
      const shown: { id?: string | number } = {};
      const write: Promise<StatementMark | null> = create({ cardAccountId: card.id, cutOff }).then(
        (row) => row,
        (e: unknown) => {
          toast.dismiss(shown.id);
          failed(e);
          return null;
        },
      );
      shown.id = toast.success(t("marked", { card: card.name }), {
        duration: UNDO_TOAST_MS,
        action: {
          label: tc("undo"),
          onClick: () => {
            void write.then(async (row) => {
              if (!row) return; // the write failed and was already rolled back
              try {
                await remove(row.id);
              } catch (e) {
                failed(e);
              }
            });
          },
        },
      });
    },
    [refused, create, remove, failed, t, tc],
  );

  const unmark = useCallback(
    (card: Pick<Account, "id" | "name">, existing: Pick<StatementMark, "id" | "cutOff">) => {
      if (refused()) return;
      const shown: { id?: string | number } = {};
      const write: Promise<boolean> = remove(existing.id).then(
        () => true,
        (e: unknown) => {
          toast.dismiss(shown.id);
          failed(e);
          return false;
        },
      );
      shown.id = toast.success(t("unmarked", { card: card.name }), {
        duration: UNDO_TOAST_MS,
        action: {
          label: tc("undo"),
          onClick: () => {
            void write.then(async (ok) => {
              if (!ok) return;
              try {
                await create({ cardAccountId: card.id, cutOff: existing.cutOff });
              } catch (e) {
                failed(e);
              }
            });
          },
        },
      });
    },
    [refused, create, remove, failed, t, tc],
  );

  return { mark, unmark };
}
