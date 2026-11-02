import { formatDate } from "@/i18n/format";
import { periodOf } from "@/domain/periods";
import type { IsoDate, Locale } from "@/domain/types";

/** "Nov 16 – Nov 30" for the quincena starting on `start`. */
export function formatPeriodRange(start: IsoDate, locale: Locale): { start: string; end: string } {
  const period = periodOf(start);
  return {
    start: formatDate(period.start, locale, "short"),
    end: formatDate(period.end, locale, "short"),
  };
}
