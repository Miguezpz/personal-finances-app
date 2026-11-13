/**
 * CSV export (FR-043, SC-013): the manual backup of Principle I.
 *  - UTF-8 with BOM so Excel opens accents correctly; RFC 4180 quoting; CRLF line endings.
 *  - Amounts in MXN with two decimals, exactly as stored — never converted (FR-032).
 *  - Text that a spreadsheet would execute as a formula (= + - @) is prefixed with ' (CSV injection).
 * Column headers are stable snake_case identifiers (machine-readable, same in every language).
 */
import { buildLedger } from "./ledger";
import { formatCentsAsInput } from "./parse";
import type { Cents, FinanceSnapshot, LedgerEntry, Uuid } from "./types";

const BOM = "﻿";
const FORMULA_START = /^[=+\-@\t\r]/;

/** One field: neutralise formulas, then quote if it has a comma, quote or line break. */
export function csvField(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Already-formatted numeric text (amounts) that must not be formula-escaped: "-1234.56" is data. */
interface Raw {
  readonly raw: string;
}
/** Numbers, booleans and Raw are written as-is (they can't start a formula by accident). */
type Cell = string | number | boolean | Raw | null;
const cell = (v: Cell) =>
  v === null ? "" : typeof v === "string" ? csvField(v) : typeof v === "object" ? v.raw : String(v);

export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const lines = [header.join(","), ...rows.map((r) => r.map(cell).join(","))];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

const money = (v: Cents | number | null): Raw | null =>
  v === null ? null : { raw: formatCentsAsInput(v as Cents) };

export interface CsvNames {
  accountName: (id: Uuid) => string;
  subcategoryName: (id: Uuid) => string;
}

export function ledgerToCsv(entries: readonly LedgerEntry[], names: CsvNames): string {
  return toCsv(
    [
      "date",
      "type",
      "description",
      "amount_mxn",
      "account",
      "bucket",
      "subcategory",
      "third_party",
    ],
    entries.map((e) => [
      e.occurredOn,
      e.type,
      e.description,
      money(e.amount),
      e.accountId ? names.accountName(e.accountId) : null,
      e.bucket,
      e.subcategoryId ? names.subcategoryName(e.subcategoryId) : null,
      e.isThirdParty,
    ]),
  );
}

/**
 * Every entity in its own CSV, plus the readable ledger: the full backup. `names` lets the UI put
 * display names (e.g. translated default subcategories) in ledger.csv; entity files keep raw data.
 */
export function snapshotToCsvBundle(
  s: FinanceSnapshot,
  names?: Partial<CsvNames>,
): Record<string, string> {
  const accountName = (id: Uuid) => s.accounts.find((a) => a.id === id)?.name ?? "";
  const storedSubcategoryName = (id: Uuid) => s.subcategories.find((x) => x.id === id)?.name ?? "";
  return {
    "ledger.csv": ledgerToCsv(buildLedger(s), {
      accountName: names?.accountName ?? accountName,
      subcategoryName: names?.subcategoryName ?? storedSubcategoryName,
    }),
    "settings.csv": toCsv(
      [
        "timezone",
        "first_payday",
        "second_payday",
        "green_min_bps",
        "yellow_min_bps",
        "collection_lead_days",
        "emergency_fund_months",
        "save_surplus",
      ],
      [
        [
          s.settings.timezone,
          s.settings.firstPayday,
          s.settings.secondPayday,
          s.settings.greenMinBps,
          s.settings.yellowMinBps,
          s.settings.collectionLeadDays,
          s.settings.emergencyFundMonths,
          s.settings.saveSurplus,
        ],
      ],
    ),
    "accounts.csv": toCsv(
      [
        "id",
        "kind",
        "name",
        "institution",
        "cut_off_day",
        "payment_due_offset_days",
        "opening_balance_mxn",
        "archived",
      ],
      s.accounts.map((a) => [
        a.id,
        a.kind,
        a.name,
        a.institution,
        a.cutOffDay,
        a.paymentDueOffsetDays,
        money(a.openingBalance),
        a.archived,
      ]),
    ),
    "distribution_rules.csv": toCsv(
      ["id", "effective_from", "needs_bps", "wants_bps", "investment_bps", "investment_subrules"],
      s.rules.map((r) => [
        r.id,
        r.effectiveFrom,
        r.needs,
        r.wants,
        r.investment,
        r.investmentSubrules.map((x) => `${accountName(x.accountId)}:${x.pct}`).join(";"),
      ]),
    ),
    "categories.csv": toCsv(
      ["id", "name", "name_key", "macro", "archived", "icon"],
      s.categories.map((c) => [c.id, c.name, c.nameKey, c.macro, c.archived, c.icon]),
    ),
    "subcategories.csv": toCsv(
      ["id", "category_id", "name", "name_key", "archived", "icon"],
      s.subcategories.map((x) => [x.id, x.categoryId, x.name, x.nameKey, x.archived, x.icon]),
    ),
    "incomes.csv": toCsv(
      [
        "id",
        "label",
        "amount_mxn",
        "received_on",
        "funded_period_start",
        "is_recurring",
        "distributed",
        "rule_id",
        "deposit_account_id",
        // Stable enum value, the same in every language (spec 004, FR-010).
        "income_type",
      ],
      s.incomes.map((i) => [
        i.id,
        i.label,
        money(i.amount),
        i.receivedOn,
        i.fundedPeriodStart,
        i.isRecurring,
        i.distributed,
        i.ruleId,
        i.depositAccountId,
        i.incomeType,
      ]),
    ),
    "income_allocations.csv": toCsv(
      ["id", "income_id", "bucket", "account_id", "amount_mxn", "period_start"],
      s.allocations.map((a) => [
        a.id,
        a.incomeId,
        a.bucket,
        a.accountId,
        money(a.amount),
        a.periodStart,
      ]),
    ),
    "recurring_expenses.csv": toCsv(
      [
        "id",
        "name",
        "amount_mxn",
        "charge_day",
        "subcategory_id",
        "bucket",
        "payment_account_id",
        "starts_on",
        "ended_on",
      ],
      s.recurring.map((r) => [
        r.id,
        r.name,
        money(r.amount),
        r.chargeDay,
        r.subcategoryId,
        r.bucket,
        r.paymentAccountId,
        r.startsOn,
        r.endedOn,
      ]),
    ),
    "expenses.csv": toCsv(
      [
        "id",
        "amount_mxn",
        "spent_on",
        "subcategory_id",
        "bucket",
        "payment_account_id",
        "note",
        "origin",
        "recurring_expense_id",
        "occurrence_date",
      ],
      s.expenses.map((e) => [
        e.id,
        money(e.amount),
        e.spentOn,
        e.subcategoryId,
        e.bucket,
        e.paymentAccountId,
        e.note,
        e.origin,
        e.recurringExpenseId,
        e.occurrenceDate,
      ]),
    ),
    // Spec 005: quick expenses (archived ones included, like the rest of the backup).
    "expense_templates.csv": toCsv(
      ["id", "name", "amount_mxn", "subcategory_id", "payment_account_id", "sort", "archived"],
      s.expenseTemplates.map((t) => [
        t.id,
        t.name,
        money(t.amount),
        t.subcategoryId,
        t.paymentAccountId,
        t.sort,
        t.archived,
      ]),
    ),
    "card_statement_marks.csv": toCsv(
      ["id", "card_account_id", "cut_off"],
      s.statementMarks.map((m) => [m.id, m.cardAccountId, m.cutOff]),
    ),
    "debtors.csv": toCsv(
      ["id", "name"],
      s.debtors.map((d) => [d.id, d.name]),
    ),
    "receivables.csv": toCsv(
      [
        "id",
        "debtor_id",
        "card_account_id",
        "description",
        "total_mxn",
        "term_months",
        "purchase_date",
      ],
      s.receivables.map((r) => [
        r.id,
        r.debtorId,
        r.cardAccountId,
        r.description,
        money(r.total),
        r.termMonths,
        r.purchaseDate,
      ]),
    ),
    "installments.csv": toCsv(
      [
        "id",
        "receivable_id",
        "seq",
        "due_on",
        "card_due_on",
        "amount_mxn",
        "collected_mxn",
        "collected_on",
        "status",
      ],
      s.installments.map((n) => [
        n.id,
        n.receivableId,
        n.seq,
        n.dueOn,
        n.cardDueOn,
        money(n.amount),
        money(n.collected),
        n.collectedOn,
        n.status,
      ]),
    ),
    "goals.csv": toCsv(
      [
        "id",
        "kind",
        "name",
        "source_bucket",
        "target_months",
        "annual_mxn",
        "monthly_mxn",
        "archived",
      ],
      s.goals.map((g) => [
        g.id,
        g.kind,
        g.name,
        g.sourceBucket,
        g.targetMonths,
        money(g.annual),
        money(g.monthly),
        g.archived,
      ]),
    ),
    "goal_contributions.csv": toCsv(
      ["id", "goal_id", "period_start", "amount_mxn", "source_bucket"],
      s.contributions.map((c) => [c.id, c.goalId, c.periodStart, money(c.amount), c.sourceBucket]),
    ),
    "net_worth_snapshots.csv": toCsv(
      ["id", "snapshot_on", "assets_mxn", "liabilities_mxn", "net_worth_mxn"],
      s.netWorthSnapshots.map((n) => [
        n.id,
        n.snapshotOn,
        money(n.assets),
        money(n.liabilities),
        money(n.netWorth),
      ]),
    ),
  };
}
