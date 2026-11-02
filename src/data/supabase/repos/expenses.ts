import type { ExpensesRepository, RecurringRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { fromExpense, fromRecurring, toExpense, toRecurring, type Insert } from "../mappers";
import { exec, execNullable, selectAll, withinRange } from "./query";

export function createExpensesRepository(db: AppSupabaseClient): ExpensesRepository {
  return {
    async list(range) {
      const rows = await selectAll((from, to) =>
        withinRange(db.from("expenses").select("*"), "spent_on", range).order("id").range(from, to),
      );
      return rows.map(toExpense);
    },

    async create(input) {
      const row = await exec(
        db
          .from("expenses")
          .insert(fromExpense(input) as Insert<"expenses">)
          .select("*")
          .single(),
      );
      return toExpense(row);
    },

    async update(id, patch) {
      const row = await exec(
        db.from("expenses").update(fromExpense(patch)).eq("id", id).select("*").single(),
      );
      return toExpense(row);
    },

    async remove(id) {
      await execNullable(db.from("expenses").delete().eq("id", id));
    },

    async materializeRecurring(items) {
      if (items.length === 0) return [];
      // INSERT ... ON CONFLICT (recurring_expense_id, occurrence_date) DO NOTHING RETURNING *:
      // idempotent across tabs and retries; returns only the rows actually inserted (FR-010).
      const rows = await exec(
        db
          .from("expenses")
          .upsert(
            items.map((i) => fromExpense(i) as Insert<"expenses">),
            {
              onConflict: "recurring_expense_id,occurrence_date",
              ignoreDuplicates: true,
            },
          )
          .select("*"),
      );
      return rows.map(toExpense);
    },
  };
}

export function createRecurringRepository(db: AppSupabaseClient): RecurringRepository {
  return {
    async list() {
      const rows = await selectAll((from, to) =>
        db.from("recurring_expenses").select("*").order("id").range(from, to),
      );
      return rows.map(toRecurring);
    },

    async create(input) {
      const row = await exec(
        db
          .from("recurring_expenses")
          .insert(fromRecurring(input) as Insert<"recurring_expenses">)
          .select("*")
          .single(),
      );
      return toRecurring(row);
    },

    async update(id, patch) {
      // Applied occurrences are snapshots in `expenses`; changes only affect future ones (FR-011).
      const row = await exec(
        db
          .from("recurring_expenses")
          .update(fromRecurring(patch))
          .eq("id", id)
          .select("*")
          .single(),
      );
      return toRecurring(row);
    },

    async end(id, endedOn) {
      await execNullable(db.from("recurring_expenses").update({ ended_on: endedOn }).eq("id", id));
    },

    async remove(id) {
      // Applied history survives: the FK nulls only recurring_expense_id (migration 0001).
      await execNullable(db.from("recurring_expenses").delete().eq("id", id));
    },
  };
}
