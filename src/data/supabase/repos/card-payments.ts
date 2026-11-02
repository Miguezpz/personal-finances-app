import type { CardPaymentsRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { toCardPayment } from "../mappers";
import { exec, execNullable, selectAll, withinRange } from "./query";

export function createCardPaymentsRepository(db: AppSupabaseClient): CardPaymentsRepository {
  return {
    async list(range) {
      const rows = await selectAll((from, to) =>
        withinRange(db.from("card_payments").select("*"), "paid_on", range)
          .order("id")
          .range(from, to),
      );
      return rows.map(toCardPayment);
    },

    async create(input) {
      // A debt settlement: lowers the card's debt and never touches Needs/Wants (FR-013b).
      const row = await exec(
        db
          .from("card_payments")
          .insert({
            card_account_id: input.cardAccountId,
            from_account_id: input.fromAccountId,
            amount_cents: input.amount,
            paid_on: input.paidOn,
            note: input.note,
          })
          .select("*")
          .single(),
      );
      return toCardPayment(row);
    },

    async remove(id) {
      await execNullable(db.from("card_payments").delete().eq("id", id));
    },
  };
}
