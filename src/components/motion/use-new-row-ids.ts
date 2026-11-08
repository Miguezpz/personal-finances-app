"use client";

/**
 * Rows that appeared after the list was first shown (spec 010, FR-004): adds animate in, the first
 * load doesn't (it already has the page reveal). `ids` is undefined while loading.
 */
import { useMemo, useState } from "react";

const EMPTY: ReadonlySet<string> = new Set();

/** `scope`: when it changes (e.g. another quincena), the list counts as freshly loaded again. */
export function useNewRowIds(
  ids: readonly string[] | undefined,
  scope: string = "",
): ReadonlySet<string> {
  const [initial, setInitial] = useState<{ scope: string; ids: ReadonlySet<string> } | null>(null);
  // Adjusting state while rendering (React's documented pattern): remember the first loaded ids.
  if (ids && (initial === null || initial.scope !== scope))
    setInitial({ scope, ids: new Set(ids) });
  return useMemo(() => {
    if (!ids || !initial || initial.scope !== scope) return EMPTY;
    return new Set(ids.filter((id) => !initial.ids.has(id)));
  }, [ids, initial, scope]);
}
