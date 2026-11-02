import type { InstallmentStatus } from "@/domain/types";
import type { ReceivablesRepository } from "../../provider";
import { ProviderError } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { toDebtor, toInstallment, toReceivable } from "../mappers";
import { exec, execNullable, selectAll } from "./query";

/** Status is derived from the collected amount (and enforced by a CHECK). */
export function installmentStatus(collected: number, amount: number): InstallmentStatus {
  if (collected <= 0) return "pending";
  return collected < amount ? "partial" : "collected";
}

export function createReceivablesRepository(db: AppSupabaseClient): ReceivablesRepository {
  return {
    async listDebtors() {
      const rows = await selectAll((from, to) =>
        db.from("debtors").select("*").order("id").range(from, to),
      );
      return rows.map(toDebtor);
    },

    async createDebtor(input) {
      const row = await exec(db.from("debtors").insert({ name: input.name }).select("*").single());
      return toDebtor(row);
    },

    async list() {
      const [receivables, installments] = await Promise.all([
        selectAll((from, to) => db.from("receivables").select("*").order("id").range(from, to)),
        selectAll((from, to) => db.from("installments").select("*").order("id").range(from, to)),
      ]);
      return {
        receivables: receivables.map(toReceivable),
        installments: installments.map(toInstallment),
      };
    },

    async create({ receivable, installments }) {
      // Atomic purchase + installments; Σ and count are validated at COMMIT (→ VALIDATION).
      const id = await exec(
        db.rpc("create_receivable", {
          p_receivable: {
            debtor_id: receivable.debtorId,
            card_account_id: receivable.cardAccountId,
            description: receivable.description,
            total_cents: receivable.total,
            term_months: receivable.termMonths,
            purchase_date: receivable.purchaseDate,
          },
          p_installments: installments.map((i) => ({
            seq: i.seq,
            due_on: i.dueOn,
            card_due_on: i.cardDueOn,
            amount_cents: i.amount,
          })),
        }),
      );
      return toReceivable(await exec(db.from("receivables").select("*").eq("id", id).single()));
    },

    async recordCollection({ installmentId, collected, collectedOn }) {
      const current = await exec(
        db.from("installments").select("amount_cents").eq("id", installmentId).single(),
      );
      if (collected < 0 || collected > current.amount_cents) {
        throw new ProviderError(
          "VALIDATION",
          "Collected amount must be between 0 and the installment amount",
        );
      }
      const row = await exec(
        db
          .from("installments")
          .update({
            collected_cents: collected,
            collected_on: collected > 0 ? collectedOn : null,
            status: installmentStatus(collected, current.amount_cents),
          })
          .eq("id", installmentId)
          .select("*")
          .single(),
      );
      return toInstallment(row);
    },

    async remove(id) {
      await execNullable(db.from("receivables").delete().eq("id", id)); // installments cascade
    },
  };
}
