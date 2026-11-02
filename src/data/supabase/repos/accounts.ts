import type { Account, Uuid } from "@/domain/types";
import type { AccountsRepository, NewEntity } from "../../provider";
import { ProviderError } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { fromAccount, toAccount, type Insert } from "../mappers";
import { chunk, exec, execNullable, selectAll } from "./query";

export function createAccountsRepository(db: AppSupabaseClient): AccountsRepository {
  async function hasPendingInstallments(cardId: Uuid): Promise<boolean> {
    const receivables = await selectAll((from, to) =>
      db.from("receivables").select("id").eq("card_account_id", cardId).order("id").range(from, to),
    );
    for (const ids of chunk(receivables.map((r) => r.id))) {
      const pending = await exec(
        db
          .from("installments")
          .select("id")
          .in("receivable_id", ids)
          .neq("status", "collected")
          .limit(1),
      );
      if (pending.length > 0) return true;
    }
    return false;
  }

  return {
    async list(opts) {
      const rows = await selectAll((from, to) => {
        const q = db.from("accounts").select("*");
        return (opts?.includeArchived ? q : q.is("archived_at", null)).order("id").range(from, to);
      });
      return rows.map(toAccount);
    },

    async create(input: NewEntity<Account>) {
      const row = await exec(
        db
          .from("accounts")
          .insert(fromAccount(input) as Insert<"accounts">)
          .select("*")
          .single(),
      );
      return toAccount(row);
    },

    async update(id, patch) {
      const row = await exec(
        db.from("accounts").update(fromAccount(patch)).eq("id", id).select("*").single(),
      );
      return toAccount(row);
    },

    async archive(id) {
      // Edge case: a card with pending MSI installments can't be archived.
      if (await hasPendingInstallments(id)) {
        throw new ProviderError("CONFLICT", "The card has pending third-party installments");
      }
      await execNullable(
        db.from("accounts").update({ archived_at: new Date().toISOString() }).eq("id", id),
      );
    },
  };
}
