"use client";

/**
 * Display name of a category / subcategory: default ones (with an i18n `nameKey`) follow the
 * active language; user-created ones are shown exactly as typed (US7-5).
 */
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { Category, Subcategory } from "@/domain/types";

export function useTaxonomyName(): (
  item: Pick<Category | Subcategory, "name" | "nameKey">,
) => string {
  const t = useTranslations();
  return useCallback(
    (item) => {
      if (!item.nameKey) return item.name;
      // Unknown keys (e.g. renamed defaults) fall back to the stored name.
      return t.has(item.nameKey as Parameters<typeof t>[0])
        ? t(item.nameKey as Parameters<typeof t>[0])
        : item.name;
    },
    [t],
  );
}
