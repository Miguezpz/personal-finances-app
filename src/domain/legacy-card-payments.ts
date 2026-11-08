/**
 * Spec 011 (FR-018): the statement an amount-based card payment recorded before spec 011 was
 * paying — the latest cut-off strictly before the payment date. The SQL conversion in migration
 * 0011 uses the same rule; the demo seed and the tests use this one. Pure.
 */
import { lastCutOffOn } from "./card-terms";
import { addDays } from "./dates";
import type { IsoDate } from "./types";

export function markForLegacyPayment(cutOffDay: number, paidOn: IsoDate): IsoDate {
  return lastCutOffOn(cutOffDay, addDays(paidOn, -1));
}
