import type { StatementMarksRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { toStatementMark } from "../mappers";
import { exec, execNullable, selectAll } from "./query";

/** "Ya la pagué" marks (spec 011): one per card and cut-off, no amount. RLS keeps them per owner. */
export function createStatementMarksRepository(db: AppSupabaseClient): StatementMarksRepository {
  return {
    async list() {
      const rows = await selectAll((from, to) =>
        db.from("card_statement_marks").select("*").order("id").range(from, to),
      );
      return rows.map(toStatementMark);
    },

    async create({ cardAccountId, cutOff }) {
      // Idempotent: a second mark on the same cut-off is ignored and the existing one is returned.
      const inserted = await execNullable(
        db
          .from("card_statement_marks")
          .upsert(
            { card_account_id: cardAccountId, cut_off: cutOff },
            { onConflict: "user_id,card_account_id,cut_off", ignoreDuplicates: true },
          )
          .select("*")
          .maybeSingle(),
      );
      if (inserted) return toStatementMark(inserted);
      const existing = await exec(
        db
          .from("card_statement_marks")
          .select("*")
          .eq("card_account_id", cardAccountId)
          .eq("cut_off", cutOff)
          .single(),
      );
      return toStatementMark(existing);
    },

    async remove(id) {
      await execNullable(db.from("card_statement_marks").delete().eq("id", id));
    },
  };
}
