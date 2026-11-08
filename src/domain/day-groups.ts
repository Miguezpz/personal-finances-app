/**
 * Day groups for movement lists (spec 009, FR-016): "Today", "Yesterday", then the date. Keeps
 * the incoming order inside each group and the groups in order of first appearance.
 */
import { addDays } from "./dates";
import type { IsoDate } from "./types";

export type DayLabel = "today" | "yesterday" | "date";

export interface DayGroup<T> {
  date: IsoDate;
  label: DayLabel;
  rows: T[];
}

export function groupByDay<T extends { date: IsoDate }>(
  rows: readonly T[],
  today: IsoDate,
): DayGroup<T>[] {
  const yesterday = addDays(today, -1);
  const groups: DayGroup<T>[] = [];
  const byDate = new Map<IsoDate, DayGroup<T>>();
  for (const row of rows) {
    let group = byDate.get(row.date);
    if (!group) {
      group = {
        date: row.date,
        label: row.date === today ? "today" : row.date === yesterday ? "yesterday" : "date",
        rows: [],
      };
      byDate.set(row.date, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}
