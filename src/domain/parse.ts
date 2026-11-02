/**
 * Parsing of user-typed amounts and percentages into exact integers — string arithmetic only,
 * never floating point (Principle II). Inputs use "." as the decimal separator and optional ","
 * thousands separators (MXN convention in both EN and ES-MX).
 */
import { BPS_TOTAL } from "./money";
import type { BasisPoints, Cents } from "./types";

const MONEY_RE = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;
const PERCENT_RE = /^(\d{1,3})(?:\.(\d{1,2}))?\s*%?$/;

/** "20,000.50" → 2000050 cents. Null if malformed, negative or too large. */
export function parseMoneyInput(input: string): Cents | null {
  const m = MONEY_RE.exec(input.trim());
  if (!m) return null;
  const whole = (m[1] as string).replace(/,/g, "");
  const fraction = (m[2] ?? "").padEnd(2, "0");
  const value = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(value) ? (value as Cents) : null;
}

/** "12.5" or "12.5%" → 1250 bps. Null if malformed or outside 0–100%. */
export function parsePercentInput(input: string): BasisPoints | null {
  const m = PERCENT_RE.exec(input.trim());
  if (!m) return null;
  const value = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return value <= BPS_TOTAL ? (value as BasisPoints) : null;
}

/** 2000050 → "20000.50" (for prefilling an input; not for display — use <Money>). */
export function formatCentsAsInput(value: Cents): string {
  const abs = Math.abs(value);
  return `${value < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** 1250 → "12.5"; 5000 → "50" (for prefilling an input). */
export function formatBpsAsPercentInput(value: BasisPoints): string {
  const whole = Math.floor(value / 100);
  const fraction = value % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}
