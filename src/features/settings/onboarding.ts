"use client";

/**
 * First-run onboarding (T054): when the account has no categories yet, create the default
 * taxonomy (categories with their i18n `nameKey` and icon; subcategories untranslated, spec 004)
 * and the default user_settings row.
 *
 * Idempotent: only missing defaults are created (categories matched by name, subcategories by
 * name within their category, since they have no key); rows another tab created first are
 * skipped by the bulk inserts. It is a BACKGROUND process,
 * so it only runs when `provider.capabilities.canWrite` — in the demo it does nothing and shows
 * nothing (FR-047a).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDataProvider } from "@/data/context";
import type { DataProvider } from "@/data/provider";
import { queryKeys } from "@/data/query-keys";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import { DEFAULT_TAXONOMY } from "@/domain/default-taxonomy";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { FinanceSnapshot } from "@/domain/types";

export const needsOnboarding = (snapshot: Pick<FinanceSnapshot, "categories">) =>
  snapshot.categories.length === 0;

/**
 * Creates whatever default is missing. Returns true if anything was written.
 *
 * Four requests in total, whatever the size of the taxonomy (26 categories and 68 subcategories
 * since spec 004): settings + every category in one insert, then the fresh category list, then every
 * subcategory in one insert. The bulk inserts skip rows that already exist, so a concurrent run in
 * another tab or a previous partial run never conflicts.
 */
export async function runOnboarding(provider: DataProvider): Promise<boolean> {
  if (!provider.capabilities.canWrite) return false;

  const categories = await provider.taxonomy.listCategories();
  if (!needsOnboarding({ categories })) return false;

  await Promise.all([
    // Persist the settings row with the defaults (upsert; harmless if it already exists).
    provider.settings.update(DEFAULT_USER_SETTINGS),
    provider.taxonomy.insertCategories(
      DEFAULT_TAXONOMY.map((def) => ({
        name: def.name,
        nameKey: def.nameKey,
        macro: def.macro,
        archived: false,
        icon: def.icon,
      })),
    ),
  ]);

  // Read back the categories (also the ones another tab may have created first).
  const byName = new Map((await provider.taxonomy.listCategories()).map((c) => [c.name, c]));
  await provider.taxonomy.insertSubcategories(
    DEFAULT_TAXONOMY.flatMap((def) => {
      const category = byName.get(def.name);
      if (!category) return [];
      return def.subcategories.map((sub) => ({
        categoryId: category.id,
        name: sub.name,
        nameKey: null,
        archived: false,
        icon: null,
      }));
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
