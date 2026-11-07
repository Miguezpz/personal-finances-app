/**
 * US8 form schemas and ledger filter state: same limits as the database CHECKs, so the user sees
 * a precise message instead of a rejected write.
 */
import { describe, expect, it } from "vitest";
import type { Subcategory, Uuid } from "@/domain/types";
import { EMPTY_LEDGER_FILTERS, isFiltering, toLedgerFilter } from "@/features/ledger/filters";
import { accountFormSchema } from "@/features/settings/accounts/schema";
import { preferencesFormSchema } from "@/features/settings/preferences/schema";
import { taxonomyNameSchema } from "@/features/settings/taxonomy/schema";

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : (r.error?.issues.map((i) => i.message) ?? []);

describe("accountFormSchema", () => {
  const base = {
    kind: "checking" as const,
    name: " Payroll ",
    institution: "",
    cutOffDay: "",
    paymentDueOffsetDays: "",
    openingBalance: "",
  };

  it("trims the name, drops card fields for non-cards and defaults the balance to 0", () => {
    const r = accountFormSchema.parse({ ...base, cutOffDay: "12", paymentDueOffsetDays: "20" });
    expect(r).toEqual({
      kind: "checking",
      name: "Payroll",
      institution: null,
      cutOffDay: null,
      paymentDueOffsetDays: null,
      openingBalance: 0,
    });
  });

  describe("card terms from a statement (spec 007)", () => {
    const card = { ...base, kind: "credit_card" as const };
    const statement = (cut: string, due: string) => ({
      ...card,
      termsMode: "statement" as const,
      statementCutOffOn: cut,
      statementDueOn: due,
    });

    it("derives the same output as typing the numbers by hand", () => {
      const fromDates = accountFormSchema.parse(statement("2026-11-22", "2026-12-07"));
      const byHand = accountFormSchema.parse({
        ...card,
        termsMode: "manual",
        cutOffDay: "22",
        paymentDueOffsetDays: "15",
      });
      expect(fromDates).toEqual(byHand);
      expect(fromDates).toMatchObject({ cutOffDay: 22, paymentDueOffsetDays: 15 });
    });

    it("reports invalid statements on the due date field", () => {
      const issues = (r: ReturnType<typeof accountFormSchema.safeParse>) =>
        r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]);
      expect(issues(accountFormSchema.safeParse(statement("2026-11-22", "2026-11-22")))).toEqual([
        ["statementDueOn", "dueNotAfterCutOff"],
      ]);
      expect(issues(accountFormSchema.safeParse(statement("2026-11-01", "2027-01-01")))).toEqual([
        ["statementDueOn", "dueTooFar"],
      ]);
      expect(issues(accountFormSchema.safeParse(statement("", "")))).toEqual([
        ["statementCutOffOn", "invalidCutOffDate"],
        ["statementDueOn", "invalidDueDate"],
      ]);
    });

    it("ignores statement dates for other kinds", () => {
      expect(
        accountFormSchema.parse({ ...statement("2026-11-22", "2026-12-07"), kind: "checking" }),
      ).toMatchObject({ cutOffDay: null, paymentDueOffsetDays: null });
    });
  });

  it("requires a cut-off day 1–31 and 1–60 days to pay for credit cards", () => {
    const card = { ...base, kind: "credit_card" as const };
    expect(
      messages(
        accountFormSchema.safeParse({ ...card, cutOffDay: "0", paymentDueOffsetDays: "61" }),
      ),
    ).toEqual(["invalidCutOffDay", "invalidDueOffset"]);
    expect(
      accountFormSchema.parse({ ...card, cutOffDay: "31", paymentDueOffsetDays: "60" }),
    ).toMatchObject({
      cutOffDay: 31,
      paymentDueOffsetDays: 60,
    });
  });

  it("limits the name to 1–60 characters and parses the balance exactly", () => {
    expect(messages(accountFormSchema.safeParse({ ...base, name: "  " }))).toEqual([
      "nameRequired",
    ]);
    expect(messages(accountFormSchema.safeParse({ ...base, name: "x".repeat(61) }))).toEqual([
      "nameTooLong",
    ]);
    expect(accountFormSchema.parse({ ...base, openingBalance: "1,234.50" }).openingBalance).toBe(
      123_450,
    );
    expect(messages(accountFormSchema.safeParse({ ...base, openingBalance: "abc" }))).toEqual([
      "invalidAmount",
    ]);
  });
});

describe("taxonomyNameSchema", () => {
  it("requires 1–60 characters", () => {
    expect(taxonomyNameSchema.parse({ name: " Pets ", macro: "wants" })).toEqual({
      name: "Pets",
      macro: "wants",
    });
    expect(messages(taxonomyNameSchema.safeParse({ name: "", macro: "needs" }))).toEqual([
      "nameRequired",
    ]);
    expect(
      messages(taxonomyNameSchema.safeParse({ name: "x".repeat(61), macro: "needs" })),
    ).toEqual(["nameTooLong"]);
  });
});

describe("preferencesFormSchema", () => {
  const valid = {
    greenMinBps: "50",
    yellowMinBps: "20",
    collectionLeadDays: "3",
    emergencyFundMonths: "6",
    firstPayday: "15",
    secondPayday: "31",
    timezone: "America/Mexico_City",
  };

  it("converts to exact settings values", () => {
    expect(preferencesFormSchema.parse({ ...valid, greenMinBps: "62.5" })).toEqual({
      greenMinBps: 6250,
      yellowMinBps: 2000,
      collectionLeadDays: 3,
      emergencyFundMonths: 6,
      firstPayday: 15,
      secondPayday: 31,
      timezone: "America/Mexico_City",
    });
  });

  it("keeps yellow below green and green above zero", () => {
    expect(messages(preferencesFormSchema.safeParse({ ...valid, yellowMinBps: "50" }))).toEqual([
      "yellowBelowGreen",
    ]);
    expect(
      messages(preferencesFormSchema.safeParse({ ...valid, greenMinBps: "0", yellowMinBps: "0" })),
    ).toEqual(["greenAboveZero", "yellowBelowGreen"]);
  });

  it("checks lead days 0–15, fund months 1–36 and payday order", () => {
    expect(
      messages(preferencesFormSchema.safeParse({ ...valid, collectionLeadDays: "16" })),
    ).toEqual(["invalidLeadDays"]);
    expect(
      preferencesFormSchema.parse({ ...valid, collectionLeadDays: "0" }).collectionLeadDays,
    ).toBe(0);
    expect(
      messages(preferencesFormSchema.safeParse({ ...valid, emergencyFundMonths: "0" })),
    ).toEqual(["invalidFundMonths"]);
    expect(
      messages(preferencesFormSchema.safeParse({ ...valid, emergencyFundMonths: "37" })),
    ).toEqual(["invalidFundMonths"]);
    expect(messages(preferencesFormSchema.safeParse({ ...valid, secondPayday: "15" }))).toEqual([
      "paydayOrder",
    ]);
  });
});

describe("ledger filter state", () => {
  const cat = "00000000-0000-4000-8000-0000000000c1" as Uuid;
  const subs: Pick<Subcategory, "id" | "categoryId">[] = [
    { id: "00000000-0000-4000-8000-0000000000s1" as Uuid, categoryId: cat },
    { id: "00000000-0000-4000-8000-0000000000s2" as Uuid, categoryId: "other" as Uuid },
  ];

  it("an empty form is no filter at all", () => {
    expect(isFiltering(EMPTY_LEDGER_FILTERS)).toBe(false);
    expect(toLedgerFilter(EMPTY_LEDGER_FILTERS, subs)).toEqual({});
  });

  it("expands a category to its subcategories and maps every control", () => {
    const state = {
      from: "2026-10-01",
      to: "2026-10-31",
      type: "expense" as const,
      categoryId: cat,
      accountId: "acc",
      thirdParty: "hide" as const,
    };
    expect(isFiltering(state)).toBe(true);
    expect(toLedgerFilter(state, subs)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      types: ["expense"],
      subcategoryIds: [subs[0]?.id],
      accountId: "acc",
      thirdParty: false,
    });
    expect(toLedgerFilter({ ...EMPTY_LEDGER_FILTERS, thirdParty: "only" }, subs)).toEqual({
      thirdParty: true,
    });
  });

  it("ignores half-typed dates", () => {
    expect(toLedgerFilter({ ...EMPTY_LEDGER_FILTERS, from: "2026-1" }, subs)).toEqual({});
  });
});
