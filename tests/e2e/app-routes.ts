/**
 * Every route of the (app) area that exists so far, for the privacy and demo sweeps (T131, T163).
 * Credit, goals and net worth join this list when Phase 12 creates them (T162/T161 complete the
 * coverage in Polish).
 */
export const APP_ROUTES = [
  "/dashboard",
  "/income",
  "/expenses",
  "/recurring",
  "/receivables",
  "/ledger",
  "/settings",
  "/settings/rules",
  "/settings/accounts",
  "/settings/categories",
  "/settings/preferences",
] as const;

/** Readable money: a currency symbol before a digit, or a grouped amount with cents (not a %). */
export const READABLE_AMOUNT = /[$€]\s?-?\d|\b\d{1,3}(?:,\d{3})*\.\d{2}\b(?!\s?%)/;
