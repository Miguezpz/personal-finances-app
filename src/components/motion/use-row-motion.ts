"use client";

/**
 * Per-row motion for movement lists (spec 010, FR-004–FR-006): `animate-row-in` for rows that
 * appeared after the first load, `animate-row-out` while a deleted row fades before it's hidden,
 * and the highlight of the row just edited. Returns the row's class and its state for tests.
 */
import { usePendingDeletes } from "@/store/pending-deletes";
import { useUi } from "@/store/ui";
import { useNewRowIds } from "./use-new-row-ids";

export interface RowMotion {
  className: (key: string, id: string) => string | undefined;
  state: (key: string, id: string) => "entering" | "leaving" | undefined;
  /** `key` for a highlight layer that replays on each successful edit, or null. */
  flashKey: (id: string) => number | null;
}

export function useRowMotion(keys: readonly string[] | undefined, scope = ""): RowMotion {
  const fresh = useNewRowIds(keys, scope);
  const leaving = usePendingDeletes((s) => s.leaving);
  const flashed = useUi((s) => s.flashed);
  const state = (key: string) =>
    leaving.has(key) ? ("leaving" as const) : fresh.has(key) ? ("entering" as const) : undefined;
  return {
    state: (key) => state(key),
    className: (key) => {
      const s = state(key);
      return s === "leaving" ? "animate-row-out" : s === "entering" ? "animate-row-in" : undefined;
    },
    flashKey: (id) => (flashed?.id === id ? flashed.at : null),
  };
}
