"use client";

/**
 * Rows that appeared after the list was first shown (spec 010, FR-004): adds animate in, the first
 * load doesn't (it already has the page reveal). `ids` is undefined while loading.
 */
import { useMemo, useState } from "react";

const EMPTY: ReadonlySet<string> = new Set();

export function useNewRowIds(ids: readonly string[] | undefined): ReadonlySet<string> {
  const [initial, setInitial] = useState<ReadonlySet<string> | null>(null);
  // Adjusting state while rendering (React's documented pattern): remember the first loaded ids.
  if (ids && initial === null) setInitial(new Set(ids));
  return useMemo(() => {
    if (!ids || !initial) return EMPTY;
    return new Set(ids.filter((id) => !initial.has(id)));
  }, [ids, initial]);
}
