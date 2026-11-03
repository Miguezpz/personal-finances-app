"use client";

/**
 * First-run onboarding (T054): when the account has no categories yet, create the default
 * taxonomy (with i18n `nameKey`s) and the default user_settings row.
 *
 * Idempotent: only missing defaults (matched by nameKey) are created, and a concurrent run in
 * another tab that wins a unique constraint (CONFLICT) is tolerated. It is a BACKGROUND process,
 * so it only runs when `provider.capabilities.canWrite` — in the demo it does nothing and shows
 * nothing (FR-047a).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDataProvider } from "@/data/context";
import { isProviderError } from "@/data/errors";
import type { DataProvider } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { DEFAULT_TAXONOMY } from "@/domain/default-taxonomy";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { Category, FinanceSnapshot } from "@/domain/types";

export const needsOnboarding = (snapshot: Pick<FinanceSnapshot, "categories">) =>
  snapshot.categories.length === 0;

async function ignoreConflict<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (e) {
    if (isProviderError(e, "CONFLICT")) return null; // another tab created it first
    throw e;
  }
}

/** Creates whatever default is missing. Returns true if anything was written. */
export async function runOnboarding(provider: DataProvider): Promise<boolean> {
  if (!provider.capabilities.canWrite) return false;

  const [categories, subcategories] = await Promise.all([
    provider.taxonomy.listCategories(),
    provider.taxonomy.listSubcategories(),
  ]);
  if (!needsOnboarding({ categories })) return false;

  // Two parallel rounds (settings + categories, then subcategories) instead of one request per row:
  // first use is fast even when the free-tier database is waking up.
  const byKey = new Map(categories.filter((c) => c.nameKey).map((c) => [c.nameKey, c]));
  const [, ...created] = await Promise.all([
    // Persist the settings row with the defaults (upsert; harmless if it already exists).
    provider.settings.update(DEFAULT_USER_SETTINGS),
    ...DEFAULT_TAXONOMY.map((def): Promise<Category | null> =>
      byKey.has(def.nameKey)
        ? Promise.resolve(byKey.get(def.nameKey) ?? null)
        : ignoreConflict(
            provider.taxonomy.createCategory({
              name: def.name,
              nameKey: def.nameKey,
              macro: def.macro,
              archived: false,
            }),
          ),
    ),
  ]);

  // A null means another tab created that category first: read the one that won.
  let resolved = created as (Category | null)[];
  if (resolved.some((c) => c === null)) {
    const latest = await provider.taxonomy.listCategories();
    resolved = DEFAULT_TAXONOMY.map(
      (def, i) => resolved[i] ?? latest.find((c) => c.nameKey === def.nameKey) ?? null,
    );
  }

  await Promise.all(
    DEFAULT_TAXONOMY.flatMap((def, i) => {
      const category = resolved[i];
      if (!category) return [];
      const existing = new Set(
        subcategories.filter((s) => s.categoryId === category.id).map((s) => s.nameKey),
      );
      return def.subcategories
        .filter((sub) => !existing.has(sub.nameKey))
        .map((sub) =>
          ignoreConflict(
            provider.taxonomy.createSubcategory({
              categoryId: category.id,
              name: sub.name,
              nameKey: sub.nameKey,
              archived: false,
            }),
          ),
        );
    }),
  );
  return true;
}

/** Runs onboarding once per session after the snapshot loads, then refreshes the cache. */
export function useOnboarding() {
  const provider = useDataProvider();
  const queryClient = useQueryClient();
  const { data: snapshot } = useFinanceSnapshot();
  const started = useRef(false);

  useEffect(() => {
    if (!provider.capabilities.canWrite || !snapshot || !needsOnboarding(snapshot)) return;
    if (started.current) return;
    started.current = true;
    void runOnboarding(provider)
      .then((wrote) => {
        if (wrote) return queryClient.invalidateQueries({ queryKey: queryKeys.snapshot });
      })
      .catch(() => {
        // Transient failure (cold start / offline): try again on the next load.
        started.current = false;
      });
  }, [provider, queryClient, snapshot]);
}
