/**
 * T120 · CSV export (FR-043, SC-013): UTF-8 BOM for Excel, RFC 4180 escaping, CRLF lines, MXN
 * amounts with two decimals and no conversion, protection against spreadsheet formula injection,
 * and a bundle with one file per entity for a full backup.
 */
import { describe, expect, it } from "vitest";
import { generateDemoSnapshot } from "@/data/mock/seed";
import { buildLedger } from "@/domain/ledger";
import { csvField, ledgerToCsv, snapshotToCsvBundle, toCsv } from "@/domain/csv";
import { cents } from "@/domain/money";
import type { IsoDate, LedgerEntry, Uuid } from "@/domain/types";

const BOM = "﻿";

const entry = (o: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: "00000000-0000-4000-8000-000000000001" as Uuid,
  type: "expense",
  occurredOn: "2026-11-03" as IsoDate,
  amount: cents(-123_456),
  description: "Groceries",
  accountId: null,
  bucket: "needs",
  subcategoryId: null,
  isThirdParty: false,
  ...o,
});

describe("csvField (RFC 4180)", () => {
  it("leaves plain values alone", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("")).toBe("");
  });

  it("quotes values with commas, quotes or line breaks, doubling inner quotes", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField("cr\r\nlf")).toBe('"cr\r\nlf"');
  });

  it("neutralises text that a spreadsheet would run as a formula", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField("-x")).toBe("'-x");
  });
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM, uses CRLF and keeps accents", () => {
    const csv = toCsv(["a", "b"], [["café", "año"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a,b\r\ncafé,año\r\n`);
  });
});

describe("ledgerToCsv", () => {
  it("writes MXN amounts with two decimals, never converted, plus readable names", () => {
    const account = "00000000-0000-4000-8000-0000000000aa" as Uuid;
    const csv = ledgerToCsv(
      [
        entry({ accountId: account, description: 'Dinner, "with" friends' }),
        entry({ type: "income", amount: cents(5), bucket: null }),
      ],
      { accountName: (id) => (id === account ? "Gold Card" : ""), subcategoryName: () => "" },
    );
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "date,type,description,amount_mxn,account,bucket,subcategory,third_party",
    );
    expect(lines[1]).toBe(
      '2026-11-03,expense,"Dinner, ""with"" friends",-1234.56,Gold Card,needs,,false',
    );
    expect(lines[2]).toBe("2026-11-03,income,Groceries,0.05,,,,false");
    expect(lines[3]).toBe("");
  });

  it("has one data row per movement for a 5-year history", () => {
    const snapshot = generateDemoSnapshot({
      today: "2026-11-01" as IsoDate,
      months: 60,
      expensesPerDay: 2,
    });
    const ledger = buildLedger(snapshot);
    const csv = ledgerToCsv(ledger, { accountName: () => "", subcategoryName: () => "" });
    expect(csv.slice(1).trimEnd().split("\r\n")).toHaveLength(ledger.length + 1);
  });
});

describe("snapshotToCsvBundle", () => {
  it("contains one CSV per entity, each with the right number of rows", () => {
    const snapshot = generateDemoSnapshot({ today: "2026-11-01" as IsoDate });
    const bundle = snapshotToCsvBundle(snapshot);
    expect(Object.keys(bundle).sort()).toEqual(
      [
        "accounts.csv",
        "card_statement_marks.csv",
        "categories.csv",
        "debtors.csv",
        "distribution_rules.csv",
        "expense_templates.csv",
        "expenses.csv",
        "goal_contributions.csv",
        "goals.csv",
        "income_allocations.csv",
        "incomes.csv",
        "installments.csv",
        "ledger.csv",
        "net_worth_snapshots.csv",
        "receivables.csv",
        "recurring_expenses.csv",
        "settings.csv",
        "subcategories.csv",
      ].sort(),
    );
    const rows = (name: string) =>
      (bundle[name] as string).slice(1).trimEnd().split("\r\n").length - 1;
    expect(rows("expenses.csv")).toBe(snapshot.expenses.length);
    expect(rows("incomes.csv")).toBe(snapshot.incomes.length);
    expect(rows("installments.csv")).toBe(snapshot.installments.length);
    expect(rows("settings.csv")).toBe(1);
    expect(bundle["expenses.csv"]).toContain("amount_mxn");
  });

  it("exports the quick expense templates (spec 005)", () => {
    const snapshot = generateDemoSnapshot({ today: "2026-11-01" as IsoDate });
    const lines = (snapshotToCsvBundle(snapshot)["expense_templates.csv"] as string)
      .slice(1)
      .trimEnd()
      .split("\r\n");
    const [template] = snapshot.expenseTemplates;
    expect(lines[0]).toBe("id,name,amount_mxn,subcategory_id,payment_account_id,sort,archived");
    expect(lines).toHaveLength(snapshot.expenseTemplates.length + 1);
    expect(lines[1]).toBe(`${template?.id},Transporte,24.00,${template?.subcategoryId},,0,false`);
  });

  it("exports the income type as a stable enum value and the taxonomy icons (spec 004)", () => {
    const snapshot = generateDemoSnapshot({ today: "2026-11-01" as IsoDate });
    const bundle = snapshotToCsvBundle(snapshot);
    const table = (name: string) =>
      (bundle[name] as string)
        .slice(1)
        .trimEnd()
        .split("\r\n")
        .map((line) => line.split(","));
    const header = (name: string) => table(name)[0] ?? [];

    const incomes = table("incomes.csv");
    const typeColumn = header("incomes.csv").indexOf("income_type");
    expect(typeColumn).toBeGreaterThan(-1);
    for (const [i, income] of snapshot.incomes.entries()) {
      expect(incomes[i + 1]?.[typeColumn]).toBe(income.incomeType);
    }
    expect(header("categories.csv")).toContain("icon");
    expect(header("subcategories.csv")).toContain("icon");
    const iconColumn = header("categories.csv").indexOf("icon");
    expect(table("categories.csv")[1]?.[iconColumn]).toBe(snapshot.categories[0]?.icon ?? "");
  });
});
