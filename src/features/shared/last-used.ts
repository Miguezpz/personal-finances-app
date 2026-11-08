"use client";

/**
 * The remembered account and subcategory of each form (spec 009, FR-001/FR-002), checked against
 * the current data: an archived or deleted account, or an archived or deleted subcategory, is
 * ignored — the field then starts empty, as if nothing were remembered.
 */
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { FinanceSnapshot } from "@/domain/types";
import { usePreferences, type LastUsed } from "@/store/preferences";

const selectActive = (s: FinanceSnapshot) => ({
  accounts: new Set(s.accounts.filter((a) => !a.archived).map((a) => a.id as string)),
  subcategories: new Set(s.subcategories.filter((x) => !x.archived).map((x) => x.id as string)),
});

/** Remembered values that still point at something usable ("" when not). */
export function useLastUsedDefaults(): Record<keyof LastUsed, string> {
  const lastUsed = usePreferences((s) => s.lastUsed);
  const { data } = useFinanceSnapshot(selectActive);
  const account = (id: string | null) => (id && data?.accounts.has(id) ? id : "");
  return {
    paymentAccountId: account(lastUsed.paymentAccountId),
    subcategoryId:
      lastUsed.subcategoryId && data?.subcategories.has(lastUsed.subcategoryId)
        ? lastUsed.subcategoryId
        : "",
    depositAccountId: account(lastUsed.depositAccountId),
    sourceAccountId: account(lastUsed.sourceAccountId),
  };
}

export const rememberLastUsed = (patch: Partial<LastUsed>) =>
  usePreferences.getState().setLastUsed(patch);
