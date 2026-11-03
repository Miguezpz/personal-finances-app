/**
 * Exchange-rate sources (T107, research.md R11). Public, free, keyless, CORS-enabled (verified
 * 2026-11-02): Frankfurter (ECB reference rates) first, open.er-api.com as fallback. Only the base
 * currency and the two symbols are sent — never any user data (Principle V). Rates are daily, not
 * live ticks; the date published by the source is kept and shown (FR-033/035).
 */
import { z } from "zod";
import { toIsoDate } from "@/domain/dates";
import type { FxSnapshot } from "@/domain/types";

export type FetchedRates = Omit<FxSnapshot, "stale">;

/** Each source gets this long, so a dead API is reported well under 10 s (SC-009). */
export const FX_TIMEOUT_MS = 4_000;

const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=MXN&symbols=USD,EUR";
const ER_API_URL = "https://open.er-api.com/v6/latest/MXN";

const positive = z.number().finite().positive();

const frankfurterSchema = z.object({
  base: z.literal("MXN"),
  date: z.string(),
  rates: z.object({ USD: positive, EUR: positive }),
});

const erApiSchema = z.object({
  result: z.literal("success"),
  time_last_update_unix: z.number().int().positive(),
  rates: z.object({ USD: positive, EUR: positive }),
});

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(FX_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`FX source responded ${response.status}`);
  return response.json();
}

async function fromFrankfurter(fetchImpl: typeof fetch): Promise<FetchedRates> {
  const data = frankfurterSchema.parse(await getJson(FRANKFURTER_URL, fetchImpl));
  return {
    base: "MXN",
    rates: { USD: data.rates.USD, EUR: data.rates.EUR },
    asOf: toIsoDate(data.date),
    fetchedAt: new Date().toISOString(),
    source: "frankfurter.dev (ECB)",
  };
}

async function fromErApi(fetchImpl: typeof fetch): Promise<FetchedRates> {
  const data = erApiSchema.parse(await getJson(ER_API_URL, fetchImpl));
  return {
    base: "MXN",
    rates: { USD: data.rates.USD, EUR: data.rates.EUR },
    asOf: toIsoDate(new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10)),
    fetchedAt: new Date().toISOString(),
    source: "open.er-api.com",
  };
}

/** Tries each source in order; throws only if all of them fail. */
export async function fetchFxRates(fetchImpl: typeof fetch = fetch): Promise<FetchedRates> {
  let lastError: unknown;
  for (const source of [fromFrankfurter, fromErApi]) {
    try {
      return await source(fetchImpl);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No exchange-rate source available");
}
