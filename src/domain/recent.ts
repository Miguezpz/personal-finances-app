/**
 * Recently used subcategories (spec 009, FR-005): the expense form offers them as one-tap chips.
 * Derived from the expense history, so every device shows the same ones. Newest first by date; on
 * the same date, the later row in the list (recorded later) wins. Archived ones are skipped.
 */
import type { Expense, Subcategory } from "./types";

export function recentSubcategories(
  expenses: readonly Pick<Expense, "spentOn" | "subcategoryId">[],
  subcategories: readonly Subcategory[],
  n = 6,
): Subcategory[] {
  const active = new Map(subcategories.filter((s) => !s.archived).map((s) => [s.id, s]));
  const ordered = expenses
    .map((e, index) => ({ e, index }))
    .sort((a, b) =>
      a.e.spentOn === b.e.spentOn ? b.index - a.index : a.e.spentOn < b.e.spentOn ? 1 : -1,
    );
  const out: Subcategory[] = [];
  const seen = new Set<string>();
  for (const { e } of ordered) {
    if (out.length >= n) break;
    if (seen.has(e.subcategoryId)) continue;
    seen.add(e.subcategoryId);
    const sub = active.get(e.subcategoryId);
    if (sub) out.push(sub);
  }
  return out;
}
