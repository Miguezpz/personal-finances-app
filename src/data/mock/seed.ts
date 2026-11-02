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
import { allocateByWeights, cents } from "@/domain/money";
import { clampChargeDay } from "@/domain/periods";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type {
  Account,
  CardPayment,
  Cents,
  Expense,
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
  Uuid,
} from "@/domain/types";
import {
  ACCOUNTS,
  ACCOUNT_IDS,
  CATEGORIES,
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
  /** Average manual expenses per day (demo ≈ 1.2; perf tests use more). */
  expensesPerDay?: number;
  seed?: number;
}

const DEFAULT_SEED = 20_261_101;
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

const dueFor = (card: Account, cutOff: IsoDate) =>
  addDays(cutOff, card.paymentDueOffsetDays as number);

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
interface SpendProfile {
  nameKey: string;
  bucket: SpendBucket;
  weight: number;
  min: number; // pesos
  max: number;
  notes?: readonly string[];
}

const PROFILES: readonly SpendProfile[] = [
  {
    nameKey: "taxonomy.groceries",
    bucket: "needs",
    weight: 5,
    min: 200,
    max: 1400,
    notes: ["Weekly groceries"],
  },
  { nameKey: "taxonomy.market", bucket: "needs", weight: 3, min: 80, max: 400 },
  { nameKey: "taxonomy.fuel", bucket: "needs", weight: 2, min: 400, max: 900 },
  { nameKey: "taxonomy.publicTransport", bucket: "needs", weight: 2, min: 30, max: 120 },
  { nameKey: "taxonomy.pharmacy", bucket: "needs", weight: 1, min: 80, max: 600 },
  {
    nameKey: "taxonomy.utilities",
    bucket: "needs",
    weight: 0.3,
    min: 300,
    max: 900,
    notes: ["Electricity"],
  },
  { nameKey: "taxonomy.doctor", bucket: "needs", weight: 0.2, min: 600, max: 1500 },
  {
    nameKey: "taxonomy.restaurants",
    bucket: "wants",
    weight: 3,
    min: 250,
    max: 900,
    notes: ["Dinner with friends"],
  },
  { nameKey: "taxonomy.coffee", bucket: "wants", weight: 4, min: 50, max: 150 },
  { nameKey: "taxonomy.events", bucket: "wants", weight: 0.5, min: 400, max: 1500 },
  { nameKey: "taxonomy.clothing", bucket: "wants", weight: 0.7, min: 400, max: 1800 },
  { nameKey: "taxonomy.electronics", bucket: "wants", weight: 0.2, min: 800, max: 3500 },
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
  nameKey: string;
  bucket: SpendBucket;
  paymentAccountId: Uuid;
}

const RECURRING: readonly RecurringSpec[] = [
  {
    name: "Rent",
    amount: 850_000,
    chargeDay: 1,
    nameKey: "taxonomy.rent",
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.debit,
  },
  {
    name: "Home internet",
    amount: 64_900,
    chargeDay: 10,
    nameKey: "taxonomy.internetPhone",
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.goldCard,
  },
  {
    name: "Streaming",
    amount: 29_900,
    chargeDay: 18,
    nameKey: "taxonomy.streaming",
    bucket: "wants",
    paymentAccountId: ACCOUNT_IDS.goldCard,
  },
  {
    name: "Mobile plan",
    amount: 39_900,
    chargeDay: 22,
    nameKey: "taxonomy.internetPhone",
    bucket: "needs",
    paymentAccountId: ACCOUNT_IDS.debit,
  },
  {
    name: "Gym",
    amount: 74_900,
    chargeDay: 31,
    nameKey: "taxonomy.gym",
    bucket: "wants",
    paymentAccountId: ACCOUNT_IDS.travelCard,
  },
];

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------
export function generateDemoSnapshot(options: SeedOptions): FinanceSnapshot {
  const { today, months = 6, expensesPerDay = 1.2, seed = DEFAULT_SEED } = options;
  const rng = mulberry32(seed);
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
    });
  }

  // --- Recurring expenses and their applied occurrences
  const recurring: RecurringExpense[] = RECURRING.map((r) => ({
    id: nextId(),
    name: r.name,
    amount: cents(r.amount),
    chargeDay: r.chargeDay,
    subcategoryId: subcategoryId(r.nameKey),
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

  // --- Manual expenses: a binomial number per day with mean `expensesPerDay`
  const trials = Math.max(1, Math.ceil(expensesPerDay * 2));
  const p = expensesPerDay / trials;
  for (let d = rangeStart; d <= today; d = addDays(d, 1)) {
    for (let t = 0; t < trials; t++) {
      if (rng() >= p) continue;
      const profile = weightedPick(rng, PROFILES);
      const amount = cents(randInt(rng, profile.min, profile.max) * 100 + (rng() < 0.3 ? 50 : 0));
      const note = profile.notes && rng() < 0.25 ? (profile.notes[0] as string) : null;
      expenses.push({
        id: nextId(),
        amount,
        spentOn: d,
        subcategoryId: subcategoryId(profile.nameKey),
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

  // --- Card payments: each statement paid in full ("totalero") two days before it is due
  const cardPayments: CardPayment[] = [];
  for (const c of cards) {
    let cutOff = statementCutOff(c, rangeStart);
    let previousCutOff = shiftCutOff(c, cutOff, -1);
    for (;;) {
      const due = dueFor(c, cutOff);
      const paidOn = addDays(due, -2);
      if (paidOn > today) break;
      const direct = expenses
        .filter(
          (e) => e.paymentAccountId === c.id && e.spentOn > previousCutOff && e.spentOn <= cutOff,
        )
        .reduce((s, e) => s + e.amount, 0);
      const msi = installments
        .filter(
          (i) =>
            i.cardDueOn === due &&
            receivables.some((r) => r.id === i.receivableId && r.cardAccountId === c.id),
        )
        .reduce((s, i) => s + i.amount, 0);
      if (direct + msi > 0) {
        cardPayments.push({
          id: nextId(),
          cardAccountId: c.id,
          fromAccountId: ACCOUNT_IDS.debit,
          amount: cents(direct + msi),
          paidOn,
          note: null,
        });
      }
      previousCutOff = cutOff;
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
    const cardCharges =
      expenses
        .filter((e) => cards.some((c) => c.id === e.paymentAccountId) && e.spentOn < on)
        .reduce((s, e) => s + e.amount, 0) +
      receivables.filter((r) => r.purchaseDate < on).reduce((s, r) => s + r.total, 0);
    const paid = cardPayments.filter((p) => p.paidOn < on).reduce((s, p) => s + p.amount, 0);
    const liabilities = Math.max(0, cardCharges - paid);
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
    cardPayments: cardPayments.sort(byDate((p) => p.paidOn)),
    debtors: DEBTORS,
    receivables,
    installments,
    goals,
    contributions,
    netWorthSnapshots,
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

/** Days covered by a snapshot generated for `today` (exposed for tests). */
export const demoRangeDays = (today: IsoDate, months = 6) =>
  daysBetween(addMonthsToMonthStart(monthStart(today), -(months - 1)), today) + 1;
