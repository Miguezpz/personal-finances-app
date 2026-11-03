/**
 * Zod schemas of the domain types, used by the contract suite to check that both providers
 * return VALID domain values (integer cents, real calendar dates, uuids, enums, ranges).
 */
import { z } from "zod";
import { isIsoDate } from "@/domain/dates";

const cents = z.number().int().refine(Number.isSafeInteger, "safe integer cents");
const positiveCents = cents.refine((v) => v > 0, "> 0");
const bps = z.number().int().min(0).max(10_000);
const isoDate = z.string().refine(isIsoDate, "valid YYYY-MM-DD date");
const uuid = z.uuid();
const bucket = z.enum(["needs", "wants", "investment"]);
const spendBucket = z.enum(["needs", "wants"]);

export const userSettingsSchema = z.strictObject({
  timezone: z.string().min(1),
  firstPayday: z.number().int().min(1).max(31),
  secondPayday: z.number().int().min(1).max(31),
  greenMinBps: bps,
  yellowMinBps: bps,
  collectionLeadDays: z.number().int().min(0).max(15),
  emergencyFundMonths: z.number().int().min(1).max(36),
});

export const accountSchema = z
  .strictObject({
    id: uuid,
    kind: z.enum(["checking", "savings", "credit_card", "investment", "cash"]),
    name: z.string().min(1).max(60),
    institution: z.string().max(60).nullable(),
    cutOffDay: z.number().int().min(1).max(31).nullable(),
    paymentDueOffsetDays: z.number().int().min(1).max(60).nullable(),
    openingBalance: cents,
    archived: z.boolean(),
  })
  .refine(
    (a) => a.kind !== "credit_card" || (a.cutOffDay !== null && a.paymentDueOffsetDays !== null),
    {
      message: "credit cards need cut-off and due offset",
    },
  );

export const ruleSchema = z
  .strictObject({
    id: uuid,
    effectiveFrom: isoDate,
    needs: bps,
    wants: bps,
    investment: bps,
    investmentSubrules: z.array(z.strictObject({ accountId: uuid, pct: bps })),
  })
  .refine((r) => r.needs + r.wants + r.investment === 10_000, "rule sums to 10000")
  .refine(
    (r) =>
      r.investment === 0
        ? r.investmentSubrules.length === 0
        : r.investmentSubrules.reduce((s, x) => s + x.pct, 0) === 10_000,
    "sub-rules sum to 10000 when investment > 0",
  );

export const categorySchema = z.strictObject({
  id: uuid,
  name: z.string().min(1).max(60),
  nameKey: z.string().nullable(),
  macro: spendBucket,
  archived: z.boolean(),
});

export const subcategorySchema = z.strictObject({
  id: uuid,
  categoryId: uuid,
  name: z.string().min(1).max(60),
  nameKey: z.string().nullable(),
  archived: z.boolean(),
});

const periodStart = isoDate.refine(
  (v) => v.endsWith("-01") || v.endsWith("-16"),
  "starts a quincena",
);

export const incomeSchema = z.strictObject({
  id: uuid,
  label: z.string().min(1).max(80),
  amount: positiveCents,
  receivedOn: isoDate,
  fundedPeriodStart: periodStart,
  isRecurring: z.boolean(),
  distributed: z.boolean(),
  ruleId: uuid.nullable(),
  depositAccountId: uuid.nullable(),
});

export const allocationSchema = z
  .strictObject({
    id: uuid,
    incomeId: uuid,
    bucket,
    accountId: uuid.nullable(),
    amount: cents.refine((v) => v >= 0, ">= 0"),
    periodStart,
  })
  .refine((a) => (a.bucket === "investment") === (a.accountId !== null), "vehicle iff investment");

export const recurringSchema = z.strictObject({
  id: uuid,
  name: z.string().min(1).max(80),
  amount: positiveCents,
  chargeDay: z.number().int().min(1).max(31),
  subcategoryId: uuid,
  bucket: spendBucket,
  paymentAccountId: uuid.nullable(),
  startsOn: isoDate,
  endedOn: isoDate.nullable(),
});

export const expenseSchema = z
  .strictObject({
    id: uuid,
    amount: positiveCents,
    spentOn: isoDate,
    subcategoryId: uuid,
    bucket: spendBucket,
    paymentAccountId: uuid.nullable(),
    note: z.string().max(200).nullable(),
    origin: z.enum(["manual", "recurring"]),
    recurringExpenseId: uuid.nullable(),
    occurrenceDate: isoDate.nullable(),
  })
  .refine(
    (e) =>
      e.origin === "manual"
        ? e.recurringExpenseId === null && e.occurrenceDate === null
        : e.occurrenceDate !== null,
    "origin consistent with recurring fields",
  );

export const cardPaymentSchema = z.strictObject({
  id: uuid,
  cardAccountId: uuid,
  fromAccountId: uuid.nullable(),
  amount: positiveCents,
  paidOn: isoDate,
  note: z.string().max(200).nullable(),
});

export const debtorSchema = z.strictObject({ id: uuid, name: z.string().min(1).max(80) });

export const receivableSchema = z.strictObject({
  id: uuid,
  debtorId: uuid,
  cardAccountId: uuid,
  description: z.string().min(1).max(120),
  total: positiveCents,
  termMonths: z.number().int().min(1).max(48),
  purchaseDate: isoDate,
});

export const installmentSchema = z
  .strictObject({
    id: uuid,
    receivableId: uuid,
    seq: z.number().int().min(1),
    dueOn: isoDate,
    cardDueOn: isoDate,
    amount: positiveCents,
    collected: cents,
    collectedOn: isoDate.nullable(),
    status: z.enum(["pending", "partial", "collected"]),
  })
  .refine((i) => i.collected >= 0 && i.collected <= i.amount, "0 ≤ collected ≤ amount")
  .refine(
    (i) =>
      i.status ===
      (i.collected === 0 ? "pending" : i.collected < i.amount ? "partial" : "collected"),
    "status derived from collected",
  );

export const goalSchema = z.strictObject({
  id: uuid,
  kind: z.enum(["emergency_fund", "sinking_fund"]),
  name: z.string().min(1).max(80),
  sourceBucket: bucket,
  targetMonths: z.number().int().min(1).max(36).nullable(),
  annual: positiveCents.nullable(),
  monthly: positiveCents.nullable(),
  archived: z.boolean(),
});

export const contributionSchema = z.strictObject({
  id: uuid,
  goalId: uuid,
  periodStart,
  amount: positiveCents,
  sourceBucket: bucket,
});

export const netWorthSnapshotSchema = z
  .strictObject({
    id: uuid,
    snapshotOn: isoDate.refine((v) => v.endsWith("-01"), "first day of month"),
    assets: cents,
    liabilities: cents.refine((v) => v >= 0, ">= 0"),
    netWorth: cents,
  })
  .refine((n) => n.netWorth === n.assets - n.liabilities, "netWorth = assets − liabilities");

export const ledgerEntrySchema = z.strictObject({
  id: uuid,
  type: z.enum([
    "income",
    "expense",
    "recurring_expense",
    "card_payment",
    "installment_collection",
  ]),
  occurredOn: isoDate,
  amount: cents,
  description: z.string(),
  accountId: uuid.nullable(),
  bucket: spendBucket.nullable(),
  subcategoryId: uuid.nullable(),
  isThirdParty: z.boolean(),
});

export const financeSnapshotSchema = z.strictObject({
  settings: userSettingsSchema,
  accounts: z.array(accountSchema),
  rules: z.array(ruleSchema),
  categories: z.array(categorySchema),
  subcategories: z.array(subcategorySchema),
  incomes: z.array(incomeSchema),
  allocations: z.array(allocationSchema),
  recurring: z.array(recurringSchema),
  expenses: z.array(expenseSchema),
  cardPayments: z.array(cardPaymentSchema),
  debtors: z.array(debtorSchema),
  receivables: z.array(receivableSchema),
  installments: z.array(installmentSchema),
  goals: z.array(goalSchema),
  contributions: z.array(contributionSchema),
  netWorthSnapshots: z.array(netWorthSnapshotSchema),
});
