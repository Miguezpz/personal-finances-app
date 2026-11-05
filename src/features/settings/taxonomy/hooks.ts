"use client";

/**
 * Taxonomy hooks (T123): catalog selector with usage counts + optimistic writes. A subcategory
 * with movements (expenses or recurring items) can't be deleted — the database rejects it with
 * CONFLICT — so the editor offers archiving instead (US8-4). A category can only be deleted once
 * it has no subcategories.
 */
import type { NewEntity } from "@/data/provider";
import { useSnapshotMutation } from "@/data/snapshot-cache";
import { useFinanceSnapshot } from "@/data/useFinanceSnapshot";
import type { Category, FinanceSnapshot, Subcategory, Uuid } from "@/domain/types";

export type TaxonomyKind = "category" | "subcategory";

const selectCatalog = (s: FinanceSnapshot) => {
  const usage = new Map<Uuid, number>();
  for (const x of [...s.expenses, ...s.recurring]) {
    usage.set(x.subcategoryId, (usage.get(x.subcategoryId) ?? 0) + 1);
  }
  return { categories: s.categories, subcategories: s.subcategories, usage };
};

export function useTaxonomyCatalog() {
  return useFinanceSnapshot(selectCatalog);
}

const patchItem = (
  s: FinanceSnapshot,
  kind: TaxonomyKind,
  id: Uuid,
  patch: Partial<Pick<Category, "name" | "nameKey" | "archived" | "icon">>,
): FinanceSnapshot =>
  kind === "category"
    ? { ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
    : { ...s, subcategories: s.subcategories.map((x) => (x.id === id ? { ...x, ...patch } : x)) };

export function useCreateCategory() {
  return useSnapshotMutation<NewEntity<Category>, Category>({
    mutationFn: (provider, input) => provider.taxonomy.createCategory(input),
    optimistic: (s, input) => ({
      ...s,
      categories: [...s.categories, { ...input, id: crypto.randomUUID() as Uuid }],
    }),
  });
}

export function useCreateSubcategory() {
  return useSnapshotMutation<NewEntity<Subcategory>, Subcategory>({
    mutationFn: (provider, input) => provider.taxonomy.createSubcategory(input),
    optimistic: (s, input) => ({
      ...s,
      subcategories: [...s.subcategories, { ...input, id: crypto.randomUUID() as Uuid }],
    }),
  });
}

/** Renaming drops the i18n key: from now on the typed name is shown in every language. */
export function useRenameTaxonomy() {
  return useSnapshotMutation<{ kind: TaxonomyKind; id: Uuid; name: string }, void>({
    mutationFn: (provider, { kind, id, name }) => provider.taxonomy.update(kind, id, { name }),
    optimistic: (s, { kind, id, name }) => patchItem(s, kind, id, { name, nameKey: null }),
  });
}

export function useSetTaxonomyArchived() {
  return useSnapshotMutation<{ kind: TaxonomyKind; id: Uuid; archived: boolean }, void>({
    mutationFn: (provider, { kind, id, archived }) =>
      provider.taxonomy.update(kind, id, { archived }),
    optimistic: (s, { kind, id, archived }) => patchItem(s, kind, id, { archived }),
  });
}

/** Icon of a category or subcategory (spec 004); null clears a subcategory's own icon. */
export function useSetTaxonomyIcon() {
  return useSnapshotMutation<{ kind: TaxonomyKind; id: Uuid; icon: string | null }, void>({
    mutationFn: (provider, { kind, id, icon }) => provider.taxonomy.update(kind, id, { icon }),
    optimistic: (s, { kind, id, icon }) => patchItem(s, kind, id, { icon }),
  });
}

export function useRemoveTaxonomy() {
  return useSnapshotMutation<{ kind: TaxonomyKind; id: Uuid }, void>({
    mutationFn: (provider, { kind, id }) => provider.taxonomy.remove(kind, id),
    optimistic: (s, { kind, id }) =>
      kind === "category"
        ? { ...s, categories: s.categories.filter((c) => c.id !== id) }
        : { ...s, subcategories: s.subcategories.filter((x) => x.id !== id) },
  });
}
