"use client";

/**
 * Pay calendar of the signed-in user (spec 006, research.md R5): derived from the paydays in
 * Preferences and the salary incomes, so registering or editing an income moves the quincena.
 */
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { buildPayCalendar, type PayCalendar } from "@/domain/pay-calendar";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { FinanceSnapshot } from "@/domain/types";

const selectCalendar = (s: FinanceSnapshot) => buildPayCalendar(s.settings, s.incomes);
const FALLBACK = buildPayCalendar(DEFAULT_USER_SETTINGS, []);

export function usePayCalendar(): PayCalendar {
  return useFinanceSnapshot(selectCalendar).data ?? FALLBACK;
}
