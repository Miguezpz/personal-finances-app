/**
 * Demo catalog (T039): fictitious accounts, the default taxonomy and a 50/30/20 rule with 90/10
 * investment sub-rules. No real data of the owner (FR-048). Ids are fixed so the demo is stable.
 */
import { DEFAULT_TAXONOMY } from "@/domain/default-taxonomy";
import { bps, cents } from "@/domain/money";
import type { Account, Category, IsoDate, Subcategory, Uuid } from "@/domain/types";

const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}` as Uuid;

export const ACCOUNT_IDS = {
  debit: id(0x1001),
  goldCard: id(0x1002),
  travelCard: id(0x1003),
  brokerage: id(0x1004),
  sofipo: id(0x1005),
  cash: id(0x1006),
} as const;

export const ACCOUNTS: readonly Account[] = [
  {
    id: ACCOUNT_IDS.debit,
    kind: "checking",
    name: "Everyday Debit",
    institution: "Demo Bank",
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: cents(3_500_000),
    archived: false,
  },
  {
    id: ACCOUNT_IDS.goldCard,
    kind: "credit_card",
    name: "Gold Card",
    institution: "Demo Bank",
    cutOffDay: 10,
    paymentDueOffsetDays: 20,
    openingBalance: cents(0),
    archived: false,
  },
  {
    id: ACCOUNT_IDS.travelCard,
    kind: "credit_card",
    name: "Travel Card",
    institution: "Sample Credit",
    cutOffDay: 25,
    paymentDueOffsetDays: 20,
    openingBalance: cents(0),
    archived: false,
  },
  {
    id: ACCOUNT_IDS.brokerage,
    kind: "investment",
    name: "Stock Brokerage",
    institution: "Demo Invest",
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: cents(12_000_000),
    archived: false,
  },
  {
    id: ACCOUNT_IDS.sofipo,
    kind: "investment",
    name: "Sofipo Savings",
    institution: "Demo Sofipo",
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: cents(5_000_000),
    archived: false,
  },
  {
    id: ACCOUNT_IDS.cash,
    kind: "cash",
    name: "Wallet",
    institution: null,
    cutOffDay: null,
    paymentDueOffsetDays: null,
    openingBalance: cents(150_000),
    archived: false,
  },
];

/** Default taxonomy with stable ids: category n → 0x2n00, its subcategories → 0x2n01.. */
export const CATEGORIES: readonly Category[] = DEFAULT_TAXONOMY.map((c, i) => ({
  id: id(0x2000 + (i + 1) * 0x100),
  name: c.name,
  nameKey: c.nameKey,
  macro: c.macro,
  archived: false,
  icon: c.icon,
}));

export const SUBCATEGORIES: readonly Subcategory[] = DEFAULT_TAXONOMY.flatMap((c, i) =>
  c.subcategories.map((s, j) => ({
    id: id(0x2000 + (i + 1) * 0x100 + j + 1),
    categoryId: id(0x2000 + (i + 1) * 0x100),
    name: s.name,
    // Default subcategories are not translated and inherit their category's icon (spec 004).
    nameKey: null,
    archived: false,
    icon: null,
  })),
);

/** Demo subcategory by its category's i18n key and its own (untranslated) name. */
export function subcategoryId(categoryNameKey: string, subName: string): Uuid {
  const category = CATEGORIES.find((c) => c.nameKey === categoryNameKey);
  const sub = SUBCATEGORIES.find((s) => s.categoryId === category?.id && s.name === subName);
  if (!sub) throw new Error(`Unknown demo subcategory ${categoryNameKey} / ${subName}`);
  return sub.id;
}

export const RULE_ID = id(0x3001);

export const rule = (effectiveFrom: IsoDate) => ({
  id: RULE_ID,
  effectiveFrom,
  needs: bps(5000),
  wants: bps(3000),
  investment: bps(2000),
  investmentSubrules: [
    { accountId: ACCOUNT_IDS.brokerage, pct: bps(9000) },
    { accountId: ACCOUNT_IDS.sofipo, pct: bps(1000) },
  ],
});

export { id as demoId };
