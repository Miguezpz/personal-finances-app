/**
 * Every route of the (app) area, for the privacy and demo sweeps (T131, T163).
 */
export const APP_ROUTES = [
  "/dashboard",
  "/income",
  "/expenses",
  "/recurring",
  "/receivables",
  "/credit",
  "/goals",
  "/net-worth",
  "/ledger",
  "/settings",
  "/settings/rules",
  "/settings/accounts",
  "/settings/categories",
  "/settings/quick-expenses",
  "/settings/preferences",
] as const;

/** Readable money: a currency symbol before a digit, or a grouped amount with cents (not a %). */
export const READABLE_AMOUNT = /[$€]\s?-?\d|\b\d{1,3}(?:,\d{3})*\.\d{2}\b(?!\s?%)/;
