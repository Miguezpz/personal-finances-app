/**
 * Last valid exchange rate on this device (T107). localStorage can be missing, full, blocked or
 * hold stale/corrupt data: every access is guarded and the value is validated before use.
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";
import type { FxSnapshot, IsoDate } from "@/domain/types";
import type { FetchedRates } from "./api";

export const FX_STORAGE_KEY = "pfa:fx:v1";

const positive = z.number().finite().positive();
const storedSchema = z.object({
  base: z.literal("MXN"),
  rates: z.object({ USD: positive, EUR: positive }),
  asOf: z.string().refine(isIsoDate),
  fetchedAt: z.string(),
  source: z.string(),
});

export function loadStoredFx(): FetchedRates | null {
  try {
    const raw = globalThis.localStorage?.getItem(FX_STORAGE_KEY);
    if (!raw) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { ...parsed.data, asOf: parsed.data.asOf as IsoDate };
  } catch {
    return null;
  }
}

export function saveStoredFx(rates: FetchedRates): void {
  try {
    globalThis.localStorage?.setItem(FX_STORAGE_KEY, JSON.stringify(rates));
  } catch {
    /* storage unavailable: the rate just won't survive a reload */
  }
}

export const withStale = (rates: FetchedRates, stale: boolean): FxSnapshot => ({ ...rates, stale });
