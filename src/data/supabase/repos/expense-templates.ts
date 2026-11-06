/**
 * Quick expenses (spec 005). A tap creates the expense through `expenses.create`; this repository
 * only manages the templates. Deleting is logical (archived = true, research R3).
 */
import type { ExpenseTemplatesRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { fromExpenseTemplate, toExpenseTemplate, type Insert } from "../mappers";
import { exec, selectAll } from "./query";

export function createExpenseTemplatesRepository(
  db: AppSupabaseClient,
): ExpenseTemplatesRepository {
  return {
    async list() {
      const rows = await selectAll((from, to) =>
        db
          .from("expense_templates")
          .select("*")
          .order("sort")
          .order("name")
          .order("id")
          .range(from, to),
      );
      return rows.map(toExpenseTemplate);
    },

    async create(input) {
      const row = await exec(
        db
          .from("expense_templates")
          .insert(fromExpenseTemplate(input) as Insert<"expense_templates">)
          .select("*")
          .single(),
      );
      return toExpenseTemplate(row);
    },

    // `.single()` turns an unknown id (0 rows, RLS included) into PGRST116 → NOT_FOUND.
    async update(id, patch) {
      const row = await exec(
        db
          .from("expense_templates")
          .update(fromExpenseTemplate(patch))
          .eq("id", id)
          .select("*")
          .single(),
      );
      return toExpenseTemplate(row);
    },

    async remove(id) {
      await exec(
        db.from("expense_templates").update({ archived: true }).eq("id", id).select("id").single(),
      );
    },

    // At most 12 active rows: one update per id, in parallel.
    async reorder(ids) {
      await Promise.all(
        ids.map((id, sort) =>
          exec(db.from("expense_templates").update({ sort }).eq("id", id).select("id").single()),
        ),
      );
    },
  };
}
