/**
 * Taxonomy icons (spec 004, FR-011–FR-013). Pure: icon KEYS only, no React. The key → component
 * map lives in `src/components/icons/category-icons.ts` and must cover every key here (`satisfies`).
 *
 * The database only checks the key FORMAT (migration 0008), so a stored key may be unknown to this
 * version of the app: `resolveTaxonomyIcon` then falls back instead of breaking the screen.
 */

/** Curated set offered by the icon picker: the 26 default categories first, then alternatives. */
export const CATEGORY_ICON_KEYS = [
  "house",
  "plug",
  "smartphone",
  "car",
  "shopping-cart",
  "heart-pulse",
  "dumbbell",
  "repeat",
  "wrench",
  "graduation-cap",
  "landmark",
  "paw-print",
  "clock-arrow-left",
  "utensils",
  "ticket",
  "tv",
  "shirt",
  "scissors",
  "gift",
  "candy",
  "headphones",
  "plane",
  "sofa",
  "palette",
  "hand-heart",
  "ellipsis",
  "coffee",
  "music",
  "book-open",
  "baby",
  "fuel",
  "bus",
  "bike",
  "gamepad-2",
  "film",
  "receipt-text",
  "tag",
  "store",
  "briefcase",
  "piggy-bank",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

/** Resolved icon: a curated key or the generic fallback. */
export type ResolvedTaxonomyIcon = CategoryIconKey | "generic";

/** Same rule as the database check of migration 0008. */
export const ICON_KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ICON_KEY_MAX_LENGTH = 40;

export const isValidIconKeyFormat = (value: string): boolean =>
  value.length <= ICON_KEY_MAX_LENGTH && ICON_KEY_FORMAT.test(value);

export const isCategoryIconKey = (value: unknown): value is CategoryIconKey =>
  typeof value === "string" && (CATEGORY_ICON_KEYS as readonly string[]).includes(value);

/**
 * Icon to show for a subcategory (or a category when `sub` is null), Clarification A:
 * the subcategory's own icon → its category's icon → the generic one. Unknown keys are skipped.
 */
export function resolveTaxonomyIcon(
  sub: { readonly icon: string | null } | null,
  category: { readonly icon: string | null } | null,
): ResolvedTaxonomyIcon {
  if (sub && isCategoryIconKey(sub.icon)) return sub.icon;
  if (category && isCategoryIconKey(category.icon)) return category.icon;
  return "generic";
}

/** Icon of the subcategory `subcategoryId` within the given catalog (lists, ledger rows). */
export function taxonomyIconFor(
  subcategoryId: string | null,
  catalog: {
    readonly subcategories: readonly {
      readonly id: string;
      readonly categoryId: string;
      readonly icon: string | null;
    }[];
    readonly categories: readonly { readonly id: string; readonly icon: string | null }[];
  },
): ResolvedTaxonomyIcon {
  const sub = catalog.subcategories.find((s) => s.id === subcategoryId) ?? null;
  const category = sub ? (catalog.categories.find((c) => c.id === sub.categoryId) ?? null) : null;
  return resolveTaxonomyIcon(sub, category);
}
