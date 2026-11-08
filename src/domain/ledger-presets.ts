/**
 * Ledger shortcuts (spec 009, FR-022): date presets and accent-insensitive text search.
 * Quincenas follow periods.ts (1–15 and 16–end of month).
 */
import { addDays, addMonthsToMonthStart, monthStart } from "./dates";
import { periodOf, previousPeriod } from "./periods";
import type { IsoDate } from "./types";

export const LEDGER_PRESETS = ["this-period", "last-period", "this-month", "last-month"] as const;
export type LedgerPreset = (typeof LEDGER_PRESETS)[number];

export function isLedgerPreset(value: unknown): value is LedgerPreset {
  return typeof value === "string" && (LEDGER_PRESETS as readonly string[]).includes(value);
}

export function presetRange(preset: LedgerPreset, today: IsoDate): { from: IsoDate; to: IsoDate } {
  switch (preset) {
    case "this-period": {
      const p = periodOf(today);
      return { from: p.start, to: p.end };
    }
    case "last-period": {
      const p = previousPeriod(periodOf(today));
      return { from: p.start, to: p.end };
    }
    case "this-month": {
      const start = monthStart(today);
      return { from: start, to: addDays(addMonthsToMonthStart(start, 1), -1) };
    }
    case "last-month": {
      const start = addMonthsToMonthStart(monthStart(today), -1);
      return { from: start, to: addDays(monthStart(today), -1) };
    }
  }
}

/** Lower case, without diacritics, trimmed: "Café " → "cafe". */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Every word of the query appears in one of the texts (note, description…). */
export function matchesSearch(
  texts: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch(texts.filter(Boolean).join(" "));
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
