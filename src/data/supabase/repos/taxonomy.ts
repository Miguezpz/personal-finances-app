import type { TaxonomyRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { archivedAt, toCategory, toSubcategory } from "../mappers";
import { exec, execNullable, selectAll } from "./query";

export function createTaxonomyRepository(db: AppSupabaseClient): TaxonomyRepository {
  return {
    async listCategories() {
      const rows = await selectAll((from, to) =>
        db.from("categories").select("*").order("id").range(from, to),
      );
      return rows.map(toCategory);
    },

    async listSubcategories() {
      const rows = await selectAll((from, to) =>
        db.from("subcategories").select("*").order("id").range(from, to),
      );
      return rows.map(toSubcategory);
    },

    async createCategory(input) {
      const row = await exec(
        db
          .from("categories")
          .insert({
            name: input.name,
            name_key: input.nameKey,
            macro: input.macro,
            archived_at: archivedAt(input.archived),
            icon: input.icon,
          })
          .select("*")
          .single(),
      );
      return toCategory(row);
    },

    async createSubcategory(input) {
      const row = await exec(
        db
          .from("subcategories")
          .insert({
            category_id: input.categoryId,
            name: input.name,
            name_key: input.nameKey,
            archived_at: archivedAt(input.archived),
            icon: input.icon,
          })
          .select("*")
          .single(),
      );
      return toSubcategory(row);
    },

    async insertCategories(inputs) {
      if (inputs.length === 0) return [];
      // One request; a name that already exists (another tab, a previous partial run) is skipped.
      const rows = await exec(
        db
          .from("categories")
          .upsert(
            inputs.map((input) => ({
              name: input.name,
              name_key: input.nameKey,
              macro: input.macro,
              archived_at: archivedAt(input.archived),
              icon: input.icon,
            })),
            { onConflict: "user_id,name", ignoreDuplicates: true },
          )
          .select("*"),
      );
      return rows.map(toCategory);
    },

    async insertSubcategories(inputs) {
      if (inputs.length === 0) return [];
      const rows = await exec(
        db
          .from("subcategories")
          .upsert(
            inputs.map((input) => ({
              category_id: input.categoryId,
              name: input.name,
              name_key: input.nameKey,
              archived_at: archivedAt(input.archived),
              icon: input.icon,
            })),
            { onConflict: "category_id,name", ignoreDuplicates: true },
          )
          .select("*"),
      );
      return rows.map(toSubcategory);
    },

    async update(kind, id, patch) {
      const values = {
        // Renaming makes the name the user's own: drop the i18n key so the typed name is shown.
        ...(patch.name !== undefined && { name: patch.name, name_key: null }),
        ...(patch.archived !== undefined && { archived_at: archivedAt(patch.archived) }),
        // The icon is independent of the name: changing it keeps the i18n key (spec 004).
        ...(patch.icon !== undefined && { icon: patch.icon }),
      };
      const table = kind === "category" ? "categories" : "subcategories";
      await execNullable(db.from(table).update(values).eq("id", id));
    },

    async remove(kind, id) {
      // FK ON DELETE RESTRICT/NO ACTION → 23503 → ProviderError('CONFLICT') when there are movements
      // (or subcategories, for a category). The caller must reassign first (US8-4).
      const table = kind === "category" ? "categories" : "subcategories";
      await execNullable(db.from(table).delete().eq("id", id));
    },
  };
}
