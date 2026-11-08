/**
 * Deterministic demo data generator (T040), always relative to "today" so the demo shows the
 * current month and the 5 before it. Fixed PRNG seed → same data for the same `today`.
 *
 * It builds data with the base domain functions (allocateByWeights, clampChargeDay) and its OWN
 * small calendar for incomes, recurring expenses and MSI, documented below. T167 checks that the
 * output satisfies the domain invariants (exact sums, dueOn < cardDueOn, recurring occurrences =
 * dueOccurrences, nothing applied in the future).
 *
 * Own calendar (mirrors research.md R3/R5/R13):
 *  - Paydays: day 15 and the last day of each month. An income funds the first quincena that
 *    starts strictly after it was received (day 1–15 → day 16; day 16–end → day 1 next month).
 *  - Recurring expense: one occurrence per month on clampChargeDay(y, m, chargeDay), applied when
 *    startsOn ≤ occurrence ≤ today.
 *  - Card statement: cut-off on clampChargeDay(y, m, cutOffDay); payment due = cut-off +
 *    paymentDueOffsetDays. A purchase belongs to the first cut-off ≥ purchase date.
 *  - MSI installment k (1..N) is billed on the statement k−1 months after the purchase's first
 *    statement: cardDueOn = that statement's due date; dueOn (collect from debtor) = cardDueOn −
 *    collectionLeadDays. Equal installments, remainder cents on the last one.
 *  - Statement marks (spec 011): every statement is marked as paid two days before it is due; the
 *    latest one whose payday is still ahead stays pending.
 *
 * No real data of the owner (FR-048).
 */
import {
  addDays,
  addMonthsToMonthStart,
  daysBetween,
  daysInMonth,
  isoDate,
  monthStart,
  parseIsoDate,
} from "@/domain/dates";
import { dueDateFor } from "@/domain/card-terms";
import { allocateByWeights, cents } from "@/domain/money";
import { clampChargeDay } from "@/domain/periods";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type {
  Account,
  Cents,
  Expense,
  ExpenseTemplate,
  FinanceSnapshot,
  Goal,
  GoalContribution,
  Income,
  IncomeAllocation,
  Installment,
  IsoDate,
  NetWorthSnapshot,
  Receivable,
  RecurringExpense,
  SpendBucket,
  StatementMark,
  Uuid,
} from "@/domain/types";
import {
  ACCOUNTS,
  ACCOUNT_IDS,
  CATEGORIES,
  EXPENSE_TEMPLATE_ID,
  SUBCATEGORIES,
  RULE_ID,
  rule,
  subcategoryId,
} from "./fixtures/catalog";
import { DEBTORS, DEBTOR_IDS } from "./fixtures/people";

export interface SeedOptions {
  /** Business date the data is relative to. */
  today: IsoDate;
  /** Months of history including the current one (demo: 6). */
  months?: number;
  /**
   * Average manual expenses per day (demo 1.5, calibrated so Needs and Wants stay positive with a
   * modest surplus: mostly green, sometimes yellow, never a negative balance; perf tests use more).
   */
  expensesPerDay?: number;
  seed?: number;
}

const DEFAULT_SEED = 20_261_101;
const EPOCH = "2000-01-01" as IsoDate;
const SALARY = cents(2_250_000); // $22,500.00 MXN per payday

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Rng = ReturnType<typeof mulberry32>;
const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

function weightedPick<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r < 0) return item;
  }
  return items[items.length - 1] as T;
}

// ---------------------------------------------------------------------------
// Own calendar helpers (see header)
// ---------------------------------------------------------------------------
const lastDayOf = (y: number, m: number) => isoDate(y, m, daysInMonth(y, m));

function fundedPeriodStart(receivedOn: IsoDate): IsoDate {
  const { year, month, day } = parseIsoDate(receivedOn);
  return day <= 15 ? isoDate(year, month, 16) : addMonthsToMonthStart(receivedOn, 1);
}

function cutOffOn(card: Account, year: number, month: number): IsoDate {
  return clampChargeDay(year, month, card.cutOffDay as number);
}

/** Cut-off of the statement a purchase falls into: the first cut-off ≥ purchase date. */
function statementCutOff(card: Account, purchase: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(purchase);
  const thisMonth = cutOffOn(card, year, month);
  if (purchase <= thisMonth) return thisMonth;
  const next = parseIsoDate(addMonthsToMonthStart(purchase, 1));
  return cutOffOn(card, next.year, next.month);
}

function shiftCutOff(card: Account, cutOff: IsoDate, months: number): IsoDate {
  const { year, month } = parseIsoDate(addMonthsToMonthStart(cutOff, months));
  return cutOffOn(card, year, month);
}

/** Same adjusted due date as the app (card-terms.ts), so the demo shows business days. */
const dueFor = (card: Account, cutOff: IsoDate) =>
  dueDateFor(
    {
      cutOffDay: card.cutOffDay as number,
      paymentDueOffsetDays: card.paymentDueOffsetDays as number,
    },
    cutOff,
  );

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
interface SpendProfile {
  /** [category nameKey, subcategory name] of the default taxonomy. */
  sub: readonly [string, string];
  bucket: SpendBucket;
  weight: number;
  min: number; // pesos
  max: number;
  /** Short, merchant-style titles; one is picked per expense so rows don't just repeat the subcategory. */
  notes: readonly string[];
}

const PROFILES: readonly SpendProfile[] = [
  {
    sub: ["taxonomy.categories.groceries", "Pantry"],
    bucket: "needs",
    weight: 5,
    min: 250,
    max: 1100,
    notes: ["Walmart", "Soriana", "Costco", "La Comer", "Chedraui"],
  },
  {
    sub: ["taxonomy.categories.groceries", "Hygiene"],
    bucket: "needs",
    weight: 3,
    min: 80,
    max: 350,
    notes: ["Farmacia", "Oxxo", "Walmart"],
  },
  {
    sub: ["taxonomy.categories.transportGas", "Fuel"],
    bucket: "needs",
    weight: 2,
    min: 400,
    max: 850,
    notes: ["Pemex", "Shell", "BP"],
  },
  {
    sub: ["taxonomy.categories.transportGas", "Public transport"],
    bucket: "needs",
    weight: 2,
    min: 30,
    max: 120,
    notes: ["Metro", "Metrobús", "Uber"],
  },
  {
    sub: ["taxonomy.categories.healthInsurance", "Medicine"],
    bucket: "needs",
    weight: 1,
    min: 80,
    max: 500,
    notes: ["Farmacia", "Similares"],
  },
  {
    sub: ["taxonomy.categories.homeServices", "Electricity"],
    bucket: "needs",
    weight: 0.3,
    min: 300,
    max: 800,
    notes: ["CFE"],
  },
  {
    sub: ["taxonomy.categories.healthInsurance", "Doctor"],
    bucket: "needs",
    weight: 0.2,
    min: 600,
    max: 1200,
    notes: ["Dentist", "Checkup"],
  },
  {
    sub: ["taxonomy.categories.restaurants", "Restaurants"],
    bucket: "wants",
    weight: 5.8,
    min: 250,
    max: 800,
    notes: ["Tacos", "Sushi", "Pizza", "Brunch", "Dinner out"],
  },
  {
    sub: ["taxonomy.categories.restaurants", "Coffee"],
    bucket: "wants",
    weight: 5.8,
    min: 50,
    max: 140,
    notes: ["Starbucks", "Café", "Cielito"],
  },
  {
    sub: ["taxonomy.categories.entertainment", "Concerts"],
    bucket: "wants",
    weight: 1.2,
    min: 400,
    max: 1400,
    notes: ["Ticketmaster", "Cinépolis"],
  },
  {
    sub: ["taxonomy.categories.clothes", "Clothing"],
    bucket: "wants",
    weight: 1.4,
    min: 400,
    max: 1600,
    notes: ["Zara", "Liverpool", "H&M"],
  },
  {
    sub: ["taxonomy.categories.tech", "Audio"],
    bucket: "wants",
    weight: 0.45,
    min: 800,
    max: 3000,
    notes: ["Amazon", "Mercado Libre"],
  },
];

const PAYMENT_METHODS = [
  { id: ACCOUNT_IDS.goldCard, weight: 50 },
  { id: ACCOUNT_IDS.travelCard, weight: 15 },
  { id: ACCOUNT_IDS.debit, weight: 25 },
  { id: ACCOUNT_IDS.cash, weight: 10 },
] as const;

interface RecurringSpec {
  name: string;
  amount: number; // cents
  chargeDay: number;
  /** [category nameKey, subcategory name] of the default taxonomy. */
  sub: readonly [string, string];
  bucket: SpendBucket;
  paymentAccountId: Uuid;
}

const RECURRING: readonly RecurringSpec[] = [
  {
    name: "Rent",
    amount: 750_000,
    chargeDay: 1,
    sub: ["taxonomy.housing", "Rent"],
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.debit,
  },
  {
    name: "Izzi",
    amount: 64_900,
    chargeDay: 10,
    sub: ["taxonomy.categories.homeServices", "Internet"],
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.goldCard,
  },
  {
    name: "Netflix",
    amount: 29_900,
    chargeDay: 18,
    sub: ["taxonomy.categories.streaming", "Video streaming"],
    bucket: "wants",
    paymentAccountId: ACCOUNT_IDS.goldCard,
  },
  {
    name: "Telcel",
    amount: 39_900,
    chargeDay: 22,
    sub: ["taxonomy.categories.telecom", "Mobile plan"],
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.debit,
  },
  {
    name: "Smart Fit",
    amount: 74_900,
    chargeDay: 31,
    sub: ["taxonomy.categories.gymWellness", "Gym"],
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.travelCard,
  },
];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------
export function generateDemoSnapshot(options: SeedOptions): FinanceSnapshot {
  const { today, months = 6, expensesPerDay = 1.5, seed = DEFAULT_SEED } = options;
  let counter = 0x10000;
  const nextId = () =>
    `00000000-0000-4000-8000-${(counter++).toString(16).padStart(12, "0")}` as Uuid;

  const rangeStart = addMonthsToMonthStart(monthStart(today), -(months - 1));
  const settings = DEFAULT_USER_SETTINGS;
  const card = (cardId: Uuid) => ACCOUNTS.find((a) => a.id === cardId) as Account;
  const cards = ACCOUNTS.filter((a) => a.kind === "credit_card");

  // --- Incomes: paydays from the last day of the month before rangeStart (funds the first quincena)
  const firstPayday = addDays(rangeStart, -1);
  const distributionRule = rule(firstPayday);
  const incomes: Income[] = [];
  const allocations: IncomeAllocation[] = [];

  const paydays: IsoDate[] = [firstPayday];
  for (let m = 0; m < months; m++) {
    const { year, month } = parseIsoDate(addMonthsToMonthStart(rangeStart, m));
    paydays.push(isoDate(year, month, 15), lastDayOf(year, month));
  }
  for (const receivedOn of paydays.filter((d) => d <= today)) {
    const incomeId = nextId();
    const periodStart = fundedPeriodStart(receivedOn);
    incomes.push({
      id: incomeId,
      label: "Salary",
      amount: SALARY,
      receivedOn,
      fundedPeriodStart: periodStart,
      isRecurring: true,
      distributed: true,
      ruleId: RULE_ID,
      depositAccountId: ACCOUNT_IDS.debit,
      incomeType: "salary",
    });
    const [needs, wants, investment] = allocateByWeights(SALARY, [
      distributionRule.needs,
      distributionRule.wants,
      distributionRule.investment,
    ]) as [Cents, Cents, Cents];
    const vehicles = allocateByWeights(
      investment,
      distributionRule.investmentSubrules.map((s) => s.pct),
    );
    allocations.push(
      { id: nextId(), incomeId, bucket: "needs", accountId: null, amount: needs, periodStart },
      { id: nextId(), incomeId, bucket: "wants", accountId: null, amount: wants, periodStart },
      ...distributionRule.investmentSubrules.map((s, i) => ({
        id: nextId(),
        incomeId,
        bucket: "investment" as const,
        accountId: s.accountId,
        amount: vehicles[i] as Cents,
        periodStart,
      })),
    );
  }
  // One non-recurring income recorded without splitting.
  const freelanceOn = addDays(rangeStart, 52);
  if (freelanceOn <= today) {
    incomes.push({
      id: nextId(),
      label: "Freelance project",
      amount: cents(650_000),
      receivedOn: freelanceOn,
      fundedPeriodStart: fundedPeriodStart(freelanceOn),
      isRecurring: false,
      distributed: false,
      ruleId: null,
      depositAccountId: ACCOUNT_IDS.debit,
      incomeType: "extra",
    });
  }

  // --- Recurring expenses and their applied occurrences
  const recurring: RecurringExpense[] = RECURRING.map((r) => ({
    id: nextId(),
    name: r.name,
    amount: cents(r.amount),
    chargeDay: r.chargeDay,
    subcategoryId: subcategoryId(...r.sub),
    bucket: r.bucket,
    paymentAccountId: r.paymentAccountId,
    startsOn: rangeStart,
    endedOn: null,
  }));
  const expenses: Expense[] = [];
  for (let m = 0; m < months; m++) {
    const { year, month } = parseIsoDate(addMonthsToMonthStart(rangeStart, m));
    for (const r of recurring) {
      const occurrence = clampChargeDay(year, month, r.chargeDay);
      if (occurrence < r.startsOn || occurrence > today) continue;
      expenses.push({
        id: nextId(),
        amount: r.amount,
        spentOn: occurrence,
        subcategoryId: r.subcategoryId,
        bucket: r.bucket,
        paymentAccountId: r.paymentAccountId,
        note: null,
        origin: "recurring",
        recurringExpenseId: r.id,
        occurrenceDate: occurrence,
      });
    }
  }

  // --- Manual expenses: a binomial number per day with mean `expensesPerDay`. Each calendar day
  // has its OWN generator (seeded by the date), so a given past day always shows the same
  // expenses no matter which "today" the demo is generated for.
  const trials = Math.max(1, Math.ceil(expensesPerDay * 2));
  const p = expensesPerDay / trials;
  for (let d = rangeStart; d <= today; d = addDays(d, 1)) {
    const rng = mulberry32(seed ^ Math.imul(daysBetween(EPOCH, d) + 1, 0x9e3779b1));
    for (let t = 0; t < trials; t++) {
      if (rng() >= p) continue;
      const profile = weightedPick(rng, PROFILES);
      const amount = cents(randInt(rng, profile.min, profile.max) * 100 + (rng() < 0.3 ? 50 : 0));
      const note = profile.notes[randInt(rng, 0, profile.notes.length - 1)] as string;
      expenses.push({
        id: nextId(),
        amount,
        spentOn: d,
        subcategoryId: subcategoryId(...profile.sub),
        bucket: profile.bucket,
        paymentAccountId: weightedPick(rng, PAYMENT_METHODS).id,
        note,
        origin: "manual",
        recurringExpenseId: null,
        occurrenceDate: null,
      });
    }
  }

  // --- Receivables (MSI for third parties)
  const receivables: Receivable[] = [];
  const installments: Installment[] = [];
  function addReceivable(spec: {
    debtorId: Uuid;
    cardId: Uuid;
    description: string;
    total: number;
    termMonths: number;
    purchaseDate: IsoDate;
    /** How collected installments are marked: the last past-due one stays pending or partial. */
    lastPastDue: "collected" | "partial" | "pending";
  }) {
    if (spec.purchaseDate > today) return;
    const receivableId = nextId();
    const c = card(spec.cardId);
    receivables.push({
      id: receivableId,
      debtorId: spec.debtorId,
      cardAccountId: spec.cardId,
      description: spec.description,
      total: cents(spec.total),
      termMonths: spec.termMonths,
      purchaseDate: spec.purchaseDate,
    });
    const base = Math.floor(spec.total / spec.termMonths);
    const firstCutOff = statementCutOff(c, spec.purchaseDate);
    const rows = Array.from({ length: spec.termMonths }, (_, i) => {
      const seq = i + 1;
      const amount = cents(
        seq === spec.termMonths ? spec.total - base * (spec.termMonths - 1) : base,
      );
      const cardDueOn = dueFor(c, shiftCutOff(c, firstCutOff, i));
      return { seq, amount, cardDueOn, dueOn: addDays(cardDueOn, -settings.collectionLeadDays) };
    });
    const pastDue = rows.filter((r) => r.dueOn <= today);
    for (const r of rows) {
      const isLastPastDue =
        pastDue.length > 0 && r.seq === (pastDue[pastDue.length - 1]?.seq ?? -1);
      const state = r.dueOn > today ? "pending" : isLastPastDue ? spec.lastPastDue : "collected";
      const collected = cents(
        state === "collected" ? r.amount : state === "partial" ? Math.floor(r.amount / 2) : 0,
      );
      installments.push({
        id: nextId(),
        receivableId,
        seq: r.seq,
        dueOn: r.dueOn,
        cardDueOn: r.cardDueOn,
        amount: r.amount,
        collected,
        collectedOn: collected > 0 ? r.dueOn : null,
        status: state,
      });
    }
  }
  addReceivable({
    debtorId: DEBTOR_IDS.ana,
    cardId: ACCOUNT_IDS.travelCard,
    description: "Laptop",
    total: 1_800_000,
    termMonths: 6,
    purchaseDate: addDays(rangeStart, 45),
    lastPastDue: "partial",
  });
  const concertDate = addDays(today, -50);
  addReceivable({
    debtorId: DEBTOR_IDS.carlos,
    cardId: ACCOUNT_IDS.goldCard,
    description: "Concert tickets",
    total: 450_000,
    termMonths: 3,
    purchaseDate: concertDate < rangeStart ? rangeStart : concertDate,
    lastPastDue: "pending",
  });

  // --- "Ya la pagué" marks (spec 011): the owner pays each statement in full ("totalero") two days
  // before it is due and marks it. The latest statement whose payday is still ahead stays unmarked,
  // so the demo always has a closed statement pending (FR-021).
  const statementMarks: StatementMark[] = [];
  /** When each mark was made (due − 2), for the net-worth history below. */
  const markedOn = new Map<Uuid, IsoDate>();
  for (const c of cards) {
    let cutOff = statementCutOff(c, rangeStart);
    for (;;) {
      const paidOn = addDays(dueFor(c, cutOff), -2);
      if (paidOn > today) break;
      const id = nextId();
      statementMarks.push({ id, cardAccountId: c.id, cutOff });
      markedOn.set(id, paidOn);
      cutOff = shiftCutOff(c, cutOff, 1);
    }
  }

  // --- Goals and monthly contributions (first quincena of each month)
  const emergencyId = nextId();
  const propertyTaxId = nextId();
  const goals: Goal[] = [
    {
      id: emergencyId,
      kind: "emergency_fund",
      name: "Emergency fund",
      sourceBucket: "investment",
      targetMonths: 6,
      annual: null,
      monthly: cents(200_000),
      archived: false,
    },
    {
      id: propertyTaxId,
      kind: "sinking_fund",
      name: "Property tax",
      sourceBucket: "needs",
      targetMonths: null,
      annual: cents(600_000),
      monthly: cents(50_000),
      archived: false,
    },
  ];
  const contributions: GoalContribution[] = [];
  for (let m = 0; m < months; m++) {
    const periodStart = addMonthsToMonthStart(rangeStart, m);
    if (periodStart > today) break;
    for (const g of goals) {
      contributions.push({
        id: nextId(),
        goalId: g.id,
        periodStart,
        amount: g.monthly as Cents,
        sourceBucket: g.sourceBucket,
      });
    }
  }

  // --- Monthly net worth snapshots (approximate history for the chart; not a domain formula)
  const netWorthSnapshots: NetWorthSnapshot[] = [];
  const openingAssets = ACCOUNTS.filter((a) => a.kind !== "credit_card").reduce(
    (s, a) => s + a.openingBalance,
    0,
  );
  for (let m = 0; m < months; m++) {
    const on = addMonthsToMonthStart(rangeStart, m);
    if (on > today) break;
    const invested = allocations
      .filter((a) => a.bucket === "investment" && a.periodStart < on)
      .reduce((s, a) => s + a.amount, 0);
    const saved = contributions
      .filter((c) => c.sourceBucket !== "investment" && c.periodStart < on)
      .reduce((s, c) => s + c.amount, 0);
    const receivable = installments
      .filter((i) => receivables.some((r) => r.id === i.receivableId && r.purchaseDate < on))
      .reduce(
        (s, i) => s + i.amount - (i.collectedOn !== null && i.collectedOn < on ? i.collected : 0),
        0,
      );
    // Card debt as of `on`: what is recorded after each card's latest statement marked before `on`.
    let liabilities = 0;
    for (const c of cards) {
      let through: IsoDate | null = null;
      for (const m of statementMarks) {
        const at = markedOn.get(m.id) as IsoDate;
        if (m.cardAccountId === c.id && at < on && (through === null || m.cutOff > through))
          through = m.cutOff;
      }
      const throughDue = through === null ? null : dueFor(c, through);
      liabilities += expenses
        .filter(
          (e) =>
            e.paymentAccountId === c.id &&
            e.spentOn < on &&
            (through === null || e.spentOn > through),
        )
        .reduce((sum, e) => sum + e.amount, 0);
      liabilities += installments
        .filter((i) => {
          const r = receivables.find((x) => x.id === i.receivableId);
          return (
            r?.cardAccountId === c.id &&
            r.purchaseDate < on &&
            (throughDue === null || i.cardDueOn > throughDue)
          );
        })
        .reduce((sum, i) => sum + i.amount, 0);
    }
    const assets = openingAssets + invested + saved + receivable;
    netWorthSnapshots.push({
      id: nextId(),
      snapshotOn: on,
      assets: cents(assets),
      liabilities: cents(liabilities),
      netWorth: cents(assets - liabilities),
    });
  }

  const byDate =
    <T>(key: (x: T) => IsoDate) =>
    (a: T, b: T) =>
      key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  return {
    settings,
    accounts: ACCOUNTS,
    rules: [distributionRule],
    categories: CATEGORIES,
    subcategories: SUBCATEGORIES,
    incomes: incomes.sort(byDate((i) => i.receivedOn)),
    allocations,
    recurring,
    expenses: expenses.sort(byDate((e) => e.spentOn)),
    statementMarks,
    debtors: DEBTORS,
    receivables,
    installments,
    goals,
    contributions,
    netWorthSnapshots,
    expenseTemplates: [
      {
        id: EXPENSE_TEMPLATE_ID,
        name: "Transporte",
        amount: cents(2400),
        subcategoryId: subcategoryId("taxonomy.categories.transportGas", "Public transport"),
        paymentAccountId: null,
        sort: 0,
        archived: false,
      } satisfies ExpenseTemplate,
    ],
  };
}

/** Fixed reference date for synthetic histories, so performance tests are reproducible. */
export const HISTORY_TODAY = "2026-11-01" as IsoDate;

/**
 * Same generator with configurable volume (T149, T165): `years` of history with ≈ 10 thousand
 * movements for 5 years.
 */
export function generateHistory(years: number, today: IsoDate = HISTORY_TODAY): FinanceSnapshot {
  return generateDemoSnapshot({
    today,
    months: Math.max(1, Math.round(years * 12)),
    expensesPerDay: 5,
  });
}
