/**
 * Unified ledger (FR-012, FR-027, FR-042): every cash movement in one list, signed MXN amounts
 * (incomes and third-party collections positive, outflows negative), newest first. Built on the
 * client from the snapshot; the SQL view `ledger_entries` has the same shape.
 */
import type { Bucket, FinanceSnapshot, IsoDate, LedgerEntry, LedgerEntryType, Uuid } from "./types";

export interface LedgerFilter {
  from?: IsoDate;
  to?: IsoDate;
  types?: readonly LedgerEntryType[];
  accountId?: Uuid;
  bucket?: Bucket;
  /** Category filter: the subcategories of the chosen category (the UI expands it). */
  subcategoryIds?: readonly Uuid[];
  /** true = only third-party movements; false = hide them; undefined = both. */
  thirdParty?: boolean;
}

const TYPE_ORDER: Record<LedgerEntryType, number> = {
  income: 0,
  installment_collection: 1,
  card_payment: 2,
  expense: 3,
  recurring_expense: 4,
};

const negate = (n: number) => (n === 0 ? 0 : -n) as LedgerEntry["amount"];

export function buildLedger(
  s: Pick<
    FinanceSnapshot,
    "incomes" | "expenses" | "cardPayments" | "receivables" | "installments"
  >,
): LedgerEntry[] {
  const receivableById = new Map(s.receivables.map((r) => [r.id, r]));
  const entries: LedgerEntry[] = [];

  for (const i of s.incomes) {
    entries.push({
      id: i.id,
      type: "income",
      occurredOn: i.receivedOn,
      amount: i.amount,
      description: i.label,
      accountId: i.depositAccountId,
      bucket: null,
      subcategoryId: null,
      isThirdParty: false,
    });
  }
  for (const e of s.expenses) {
    entries.push({
      id: e.id,
      type: e.origin === "recurring" ? "recurring_expense" : "expense",
      occurredOn: e.spentOn,
      amount: negate(e.amount),
      description: e.note ?? "",
      accountId: e.paymentAccountId,
      bucket: e.bucket,
      subcategoryId: e.subcategoryId,
      isThirdParty: false,
    });
  }
  for (const p of s.cardPayments) {
    entries.push({
      id: p.id,
      type: "card_payment",
      occurredOn: p.paidOn,
      amount: negate(p.amount),
      description: p.note ?? "",
      accountId: p.cardAccountId,
      bucket: null,
      subcategoryId: null,
      isThirdParty: false,
    });
  }
  for (const n of s.installments) {
    if (n.collected <= 0) continue;
    const r = receivableById.get(n.receivableId);
    entries.push({
      id: n.id,
      type: "installment_collection",
      occurredOn: n.collectedOn ?? n.dueOn,
      amount: n.collected,
      description: r?.description ?? "",
      accountId: r?.cardAccountId ?? null,
      bucket: null,
      subcategoryId: null,
      isThirdParty: true,
    });
  }

  return entries.sort(
    (a, b) =>
      (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.id.localeCompare(b.id),
  );
}

export function filterLedger(entries: readonly LedgerEntry[], filter: LedgerFilter): LedgerEntry[] {
  const types = filter.types && filter.types.length > 0 ? new Set(filter.types) : null;
  const subcategories = filter.subcategoryIds ? new Set(filter.subcategoryIds) : null;
  return entries.filter(
    (e) =>
      (!filter.from || e.occurredOn >= filter.from) &&
      (!filter.to || e.occurredOn <= filter.to) &&
      (!types || types.has(e.type)) &&
      (!filter.accountId || e.accountId === filter.accountId) &&
      (!filter.bucket || e.bucket === filter.bucket) &&
      (!subcategories || (e.subcategoryId !== null && subcategories.has(e.subcategoryId))) &&
      (filter.thirdParty === undefined || e.isThirdParty === filter.thirdParty),
  );
}
