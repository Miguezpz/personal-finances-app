/**
 * SQL row ⇄ domain type conversions and Postgres/PostgREST error mapping (T029).
 * Rows use snake_case, bigint cents and `date` strings; the domain uses branded Cents/IsoDate/Uuid.
 */
import { toIsoDate } from "@/domain/dates";
import { bps, cents } from "@/domain/money";
import type {
  Account,
  CardPayment,
  Category,
  Debtor,
  DistributionRule,
  Expense,
  Goal,
  GoalContribution,
  Income,
  IncomeAllocation,
  Installment,
  IsoDate,
  LedgerEntry,
  LedgerEntryType,
  NetWorthSnapshot,
  Receivable,
  RecurringExpense,
  Subcategory,
  UserSettings,
  Uuid,
} from "@/domain/types";
import { ProviderError, type ProviderErrorCode } from "../provider";
import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];
export type LedgerRow = Database["public"]["Views"]["ledger_entries"]["Row"];

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------
export const uuid = (v: string): Uuid => v as Uuid;
export const uuidOrNull = (v: string | null): Uuid | null => (v === null ? null : uuid(v));
export const date = (v: string): IsoDate => toIsoDate(v);
export const dateOrNull = (v: string | null): IsoDate | null => (v === null ? null : date(v));
export const centsOrNull = (v: number | null) => (v === null ? null : cents(v));

/** `archived` boolean ⇄ `archived_at` timestamp. */
export const archivedAt = (archived: boolean): string | null =>
  archived ? new Date().toISOString() : null;

// ---------------------------------------------------------------------------
// Row → domain
// ---------------------------------------------------------------------------
export const toUserSettings = (r: Row<"user_settings">): UserSettings => ({
  timezone: r.timezone,
  firstPayday: r.first_payday,
  secondPayday: r.second_payday,
  greenMinBps: bps(r.green_min_bps),
  yellowMinBps: bps(r.yellow_min_bps),
  collectionLeadDays: r.collection_lead_days,
  emergencyFundMonths: r.emergency_fund_months,
});

export const toAccount = (r: Row<"accounts">): Account => ({
  id: uuid(r.id),
  kind: r.kind,
  name: r.name,
  institution: r.institution,
  cutOffDay: r.cut_off_day,
  paymentDueOffsetDays: r.payment_due_offset_days,
  openingBalance: cents(r.opening_balance_cents),
  archived: r.archived_at !== null,
});

export const toRule = (
  r: Row<"distribution_rules">,
  subrules: readonly Row<"investment_subrules">[],
): DistributionRule => ({
  id: uuid(r.id),
  effectiveFrom: date(r.effective_from),
  needs: bps(r.needs_bps),
  wants: bps(r.wants_bps),
  investment: bps(r.investment_bps),
  investmentSubrules: subrules
    .filter((s) => s.rule_id === r.id)
    .map((s) => ({ accountId: uuid(s.account_id), pct: bps(s.pct_bps) })),
});

export const toCategory = (r: Row<"categories">): Category => ({
  id: uuid(r.id),
  name: r.name,
  nameKey: r.name_key,
  macro: r.macro,
  archived: r.archived_at !== null,
});

export const toSubcategory = (r: Row<"subcategories">): Subcategory => ({
  id: uuid(r.id),
  categoryId: uuid(r.category_id),
  name: r.name,
  nameKey: r.name_key,
  archived: r.archived_at !== null,
});

export const toIncome = (r: Row<"incomes">): Income => ({
  id: uuid(r.id),
  label: r.label,
  amount: cents(r.amount_cents),
  receivedOn: date(r.received_on),
  fundedPeriodStart: date(r.funded_period_start),
  isRecurring: r.is_recurring,
  distributed: r.distributed,
  ruleId: uuidOrNull(r.rule_id),
  depositAccountId: uuidOrNull(r.deposit_account_id),
});

export const toAllocation = (r: Row<"income_allocations">): IncomeAllocation => ({
  id: uuid(r.id),
  incomeId: uuid(r.income_id),
  bucket: r.bucket,
  accountId: uuidOrNull(r.account_id),
  amount: cents(r.amount_cents),
  periodStart: date(r.period_start),
});

export const toRecurring = (r: Row<"recurring_expenses">): RecurringExpense => ({
  id: uuid(r.id),
  name: r.name,
  amount: cents(r.amount_cents),
  chargeDay: r.charge_day,
  subcategoryId: uuid(r.subcategory_id),
  bucket: r.bucket,
  paymentAccountId: uuidOrNull(r.payment_account_id),
  startsOn: date(r.starts_on),
  endedOn: dateOrNull(r.ended_on),
});

export const toExpense = (r: Row<"expenses">): Expense => ({
  id: uuid(r.id),
  amount: cents(r.amount_cents),
  spentOn: date(r.spent_on),
  subcategoryId: uuid(r.subcategory_id),
  bucket: r.bucket,
  paymentAccountId: uuidOrNull(r.payment_account_id),
  note: r.note,
  origin: r.origin,
  recurringExpenseId: uuidOrNull(r.recurring_expense_id),
  occurrenceDate: dateOrNull(r.occurrence_date),
});

export const toCardPayment = (r: Row<"card_payments">): CardPayment => ({
  id: uuid(r.id),
  cardAccountId: uuid(r.card_account_id),
  fromAccountId: uuidOrNull(r.from_account_id),
  amount: cents(r.amount_cents),
  paidOn: date(r.paid_on),
  note: r.note,
});

export const toDebtor = (r: Row<"debtors">): Debtor => ({ id: uuid(r.id), name: r.name });

export const toReceivable = (r: Row<"receivables">): Receivable => ({
  id: uuid(r.id),
  debtorId: uuid(r.debtor_id),
  cardAccountId: uuid(r.card_account_id),
  description: r.description,
  total: cents(r.total_cents),
  termMonths: r.term_months,
  purchaseDate: date(r.purchase_date),
});

export const toInstallment = (r: Row<"installments">): Installment => ({
  id: uuid(r.id),
  receivableId: uuid(r.receivable_id),
  seq: r.seq,
  dueOn: date(r.due_on),
  cardDueOn: date(r.card_due_on),
  amount: cents(r.amount_cents),
  collected: cents(r.collected_cents),
  collectedOn: dateOrNull(r.collected_on),
  status: r.status,
});

export const toGoal = (r: Row<"goals">): Goal => ({
  id: uuid(r.id),
  kind: r.kind,
  name: r.name,
  sourceBucket: r.source_bucket,
  targetMonths: r.target_months,
  annual: centsOrNull(r.annual_cents),
  monthly: centsOrNull(r.monthly_cents),
  archived: r.archived_at !== null,
});

export const toContribution = (r: Row<"goal_contributions">): GoalContribution => ({
  id: uuid(r.id),
  goalId: uuid(r.goal_id),
  periodStart: date(r.period_start),
  amount: cents(r.amount_cents),
  sourceBucket: r.source_bucket,
});

export const toNetWorthSnapshot = (r: Row<"net_worth_snapshots">): NetWorthSnapshot => ({
  id: uuid(r.id),
  snapshotOn: date(r.snapshot_on),
  assets: cents(r.assets_cents),
  liabilities: cents(r.liabilities_cents),
  // Generated column; never null for a stored row.
  netWorth: cents(r.net_worth_cents ?? r.assets_cents - r.liabilities_cents),
});

const LEDGER_TYPES: readonly LedgerEntryType[] = [
  "income",
  "expense",
  "recurring_expense",
  "card_payment",
  "installment_collection",
];

export function toLedgerEntry(r: LedgerRow): LedgerEntry {
  const type = LEDGER_TYPES.find((t) => t === r.entry_type);
  if (!type || r.id === null || r.occurred_on === null || r.amount_cents === null) {
    throw new ProviderError("UNKNOWN", `Malformed ledger row (${r.entry_type ?? "?"})`);
  }
  return {
    id: uuid(r.id),
    type,
    occurredOn: date(r.occurred_on),
    amount: cents(r.amount_cents),
    description: r.description ?? "",
    accountId: uuidOrNull(r.account_id),
    bucket: r.bucket,
    subcategoryId: uuidOrNull(r.subcategory_id),
    isThirdParty: r.is_third_party ?? false,
  };
}

// ---------------------------------------------------------------------------
// Domain → row (writes)
// ---------------------------------------------------------------------------
export const fromAccount = (a: Partial<Omit<Account, "id">>): Update<"accounts"> => ({
  ...(a.kind !== undefined && { kind: a.kind }),
  ...(a.name !== undefined && { name: a.name }),
  ...(a.institution !== undefined && { institution: a.institution }),
  ...(a.cutOffDay !== undefined && { cut_off_day: a.cutOffDay }),
  ...(a.paymentDueOffsetDays !== undefined && { payment_due_offset_days: a.paymentDueOffsetDays }),
  ...(a.openingBalance !== undefined && { opening_balance_cents: a.openingBalance }),
  ...(a.archived !== undefined && { archived_at: archivedAt(a.archived) }),
});

export const fromSettings = (s: Partial<UserSettings>): Update<"user_settings"> => ({
  ...(s.timezone !== undefined && { timezone: s.timezone }),
  ...(s.firstPayday !== undefined && { first_payday: s.firstPayday }),
  ...(s.secondPayday !== undefined && { second_payday: s.secondPayday }),
  ...(s.greenMinBps !== undefined && { green_min_bps: s.greenMinBps }),
  ...(s.yellowMinBps !== undefined && { yellow_min_bps: s.yellowMinBps }),
  ...(s.collectionLeadDays !== undefined && { collection_lead_days: s.collectionLeadDays }),
  ...(s.emergencyFundMonths !== undefined && { emergency_fund_months: s.emergencyFundMonths }),
});

export const fromIncome = (i: Omit<Income, "id">) => ({
  label: i.label,
  amount_cents: i.amount,
  received_on: i.receivedOn,
  funded_period_start: i.fundedPeriodStart,
  is_recurring: i.isRecurring,
  distributed: i.distributed,
  rule_id: i.ruleId,
  deposit_account_id: i.depositAccountId,
});

export const fromAllocation = (a: Omit<IncomeAllocation, "id" | "incomeId">) => ({
  bucket: a.bucket,
  account_id: a.accountId,
  amount_cents: a.amount,
  period_start: a.periodStart,
});

export const fromRecurring = (
  r: Partial<Omit<RecurringExpense, "id">>,
): Update<"recurring_expenses"> => ({
  ...(r.name !== undefined && { name: r.name }),
  ...(r.amount !== undefined && { amount_cents: r.amount }),
  ...(r.chargeDay !== undefined && { charge_day: r.chargeDay }),
  ...(r.subcategoryId !== undefined && { subcategory_id: r.subcategoryId }),
  ...(r.bucket !== undefined && { bucket: r.bucket }),
  ...(r.paymentAccountId !== undefined && { payment_account_id: r.paymentAccountId }),
  ...(r.startsOn !== undefined && { starts_on: r.startsOn }),
  ...(r.endedOn !== undefined && { ended_on: r.endedOn }),
});

export const fromExpense = (e: Partial<Omit<Expense, "id">>): Update<"expenses"> => ({
  ...(e.amount !== undefined && { amount_cents: e.amount }),
  ...(e.spentOn !== undefined && { spent_on: e.spentOn }),
  ...(e.subcategoryId !== undefined && { subcategory_id: e.subcategoryId }),
  ...(e.bucket !== undefined && { bucket: e.bucket }),
  ...(e.paymentAccountId !== undefined && { payment_account_id: e.paymentAccountId }),
  ...(e.note !== undefined && { note: e.note }),
  ...(e.origin !== undefined && { origin: e.origin }),
  ...(e.recurringExpenseId !== undefined && { recurring_expense_id: e.recurringExpenseId }),
  ...(e.occurrenceDate !== undefined && { occurrence_date: e.occurrenceDate }),
});

export const fromGoal = (g: Partial<Omit<Goal, "id">>): Update<"goals"> => ({
  ...(g.kind !== undefined && { kind: g.kind }),
  ...(g.name !== undefined && { name: g.name }),
  ...(g.sourceBucket !== undefined && { source_bucket: g.sourceBucket }),
  ...(g.targetMonths !== undefined && { target_months: g.targetMonths }),
  ...(g.annual !== undefined && { annual_cents: g.annual }),
  ...(g.monthly !== undefined && { monthly_cents: g.monthly }),
  ...(g.archived !== undefined && { archived_at: archivedAt(g.archived) }),
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
/** Shape shared by PostgrestError, AuthError and fetch failures. */
export interface RawSupabaseError {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
}

const COLD_START_STATUS = new Set([502, 503, 504, 520, 521, 522, 523, 524, 544]);

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function codeFor(err: RawSupabaseError, status: number | undefined): ProviderErrorCode {
  switch (err.code) {
    case "23514": // check_violation (incl. exact-sum triggers)
    case "23502": // not_null_violation
    case "22P02": // invalid_text_representation (bad uuid/date)
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
      return "VALIDATION";
    case "23505": // unique_violation (idempotency, rule already used)
    case "23503": // foreign_key_violation (delete with movements, cross references)
      return "CONFLICT";
    case "P0002": // no_data_found (replace_income)
    case "PGRST116": // .single() with 0 rows
      return "NOT_FOUND";
    case "42501": // insufficient_privilege / RLS
    case "PGRST301": // JWT invalid
    case "PGRST303": // JWT expired
      return "UNAUTHENTICATED";
    case "57014": // statement_timeout
    case "PGRST002": // schema cache still loading (project waking up)
      return "COLD_START";
  }
  if (status !== undefined && COLD_START_STATUS.has(status)) return "COLD_START";
  if (status === 401) return "UNAUTHENTICATED";
  const msg = (err.message ?? "").toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("fetch failed") || msg.includes("network")) {
    return isOffline() ? "OFFLINE" : "COLD_START";
  }
  return isOffline() ? "OFFLINE" : "UNKNOWN";
}

export function toProviderError(err: RawSupabaseError, status?: number): ProviderError {
  const code = codeFor(err, status ?? err.status);
  return new ProviderError(code, err.message || code, err);
}

/** Unwraps a supabase-js `{ data, error, status }` result or throws a typed ProviderError. */
export function unwrap<T>(result: {
  data: T | null;
  error: RawSupabaseError | null;
  status?: number;
}): T {
  if (result.error) throw toProviderError(result.error, result.status);
  if (result.data === null) throw new ProviderError("NOT_FOUND", "No data returned");
  return result.data;
}

/** Turns a thrown value (e.g. a fetch TypeError) into a ProviderError. */
export function toProviderErrorFromUnknown(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof Error) return toProviderError({ message: e.message, name: e.name });
  return new ProviderError("UNKNOWN", String(e), e);
}
