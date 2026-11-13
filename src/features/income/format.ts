import { formatDate } from "@/i18n/format";
import type { Locale, Period } from "@/domain/types";

/** "Nov 13 – Nov 29": the effective range of a quincena (spec 006); nominal if it has no calendar. */
export function formatPeriodRange(
  period: Pick<Period, "from" | "to">,
  locale: Locale,
): { start: string; end: string } {
  return {
    start: formatDate(period.from, locale, "short"),
    end: formatDate(period.to, locale, "short"),
  };
}
