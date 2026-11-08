/**
 * Deletions waiting for their Undo window to close (spec 009, US2, research.md R3). In memory
 * only. Each entry hides its row from every snapshot selector (useFinanceSnapshot applies
 * `apply`), so balances, lists and export agree while the toast is on screen, and a refetch
 * can't bring the row back early.
 */
import { create } from "zustand";
import type { FinanceSnapshot } from "@/domain/types";

export interface PendingDelete {
  key: string;
  apply: (snapshot: FinanceSnapshot) => FinanceSnapshot;
}

interface PendingDeletesStore {
  entries: readonly PendingDelete[];
  /** Rows playing their exit animation before they're hidden (spec 010, FR-005). */
  leaving: ReadonlySet<string>;
  add(entry: PendingDelete): void;
  remove(key: string): void;
  markLeaving(key: string): void;
  clearLeaving(key: string): void;
}

export const usePendingDeletes = create<PendingDeletesStore>()((set) => ({
  entries: [],
  leaving: new Set(),
  markLeaving: (key) => set((s) => ({ leaving: new Set([...s.leaving, key]) })),
  clearLeaving: (key) =>
    set((s) => {
      if (!s.leaving.has(key)) return s;
      const leaving = new Set(s.leaving);
      leaving.delete(key);
      return { leaving };
    }),
  add: (entry) =>
    set((s) => ({ entries: [...s.entries.filter((e) => e.key !== entry.key), entry] })),
  remove: (key) => set((s) => ({ entries: s.entries.filter((e) => e.key !== key) })),
}));

export function hidePending(
  snapshot: FinanceSnapshot,
  entries: readonly PendingDelete[],
): FinanceSnapshot {
  return entries.reduce((s, e) => e.apply(s), snapshot);
}
