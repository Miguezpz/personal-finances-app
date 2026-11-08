/**
 * Domain entity builders for tests (T055). Every builder returns a valid entity with sensible
 * defaults; override any field. Ids are deterministic per process.
 */
import { bps, cents } from "@/domain/money";
import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type {
  Account,
  Category,
  DistributionRule,
  Expense,
  ExpenseTemplate,
  FinanceSnapshot,
  Goal,
  Income,
  IncomeAllocation,
  Installment,
  IsoDate,
  Receivable,
  RecurringExpense,
  Subcategory,
  Uuid,
  StatementMark,
} from "@/domain/types";

let seq = 0;
export const testId = (): Uuid =>
  `00000000-0000-4000-9000-${(++seq).toString(16).padStart(12, "0")}` as Uuid;
export const d = (s: string) => s as IsoDate;

export const emptySnapshot = (overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
  settings: DEFAULT_USER_SETTINGS,
  accounts: [],
  rules: [],
  categories: [],
  subcategories: [],
  incomes: [],
  allocations: [],
  recurring: [],
  expenses: [],
  statementMarks: [],
  debtors: [],
  receivables: [],
  installments: [],
  goals: [],
  contributions: [],
  netWorthSnapshots: [],
  expenseTemplates: [],
  ...overrides,
});

export const makeTemplate = (o: Partial<ExpenseTemplate> = {}): ExpenseTemplate => ({
  id: testId(),
  name: "Transporte",
  amount: cents(2400),
  subcategoryId: testId(),
  paymentAccountId: null,
  sort: 0,
  archived: false,
  ...o,
});

export const makeAccount = (o: Partial<Account> = {}): Account => ({
  id: testId(),
  kind: "checking",
  name: "Debit",
  institution: null,
  cutOffDay: null,
  paymentDueOffsetDays: null,
  openingBalance: cents(0),
  archived: false,
  ...o,
});

export const makeCard = (o: Partial<Account> = {}): Account =>
  makeAccount({ kind: "credit_card", name: "Card", cutOffDay: 10, paymentDueOffsetDays: 20, ...o });

export const makeCategory = (o: Partial<Category> = {}): Category => ({
  id: testId(),
  name: "Home",
  nameKey: null,
  macro: "needs",
  archived: false,
  icon: null,
  ...o,
});

export const makeSubcategory = (o: Partial<Subcategory> = {}): Subcategory => ({
  id: testId(),
  categoryId: testId(),
  name: "Rent",
  nameKey: null,
  archived: false,
  icon: null,
  ...o,
});

export const makeRule = (o: Partial<DistributionRule> = {}): DistributionRule => ({
  id: testId(),
  effectiveFrom: d("2026-01-01"),
  needs: bps(5000),
  wants: bps(3000),
  investment: bps(2000),
  investmentSubrules: [],
  ...o,
});

export const makeIncome = (o: Partial<Income> = {}): Income => ({
  id: testId(),
  label: "Salary",
  amount: cents(2_000_000),
  receivedOn: d("2026-11-15"),
  fundedPeriodStart: d("2026-11-16"),
  isRecurring: true,
  distributed: true,
  ruleId: null,
  depositAccountId: null,
  incomeType: "salary",
  ...o,
});

export const makeAllocation = (o: Partial<IncomeAllocation> = {}): IncomeAllocation => ({
  id: testId(),
  incomeId: testId(),
  bucket: "needs",
  accountId: null,
  amount: cents(100_000),
  periodStart: d("2026-11-16"),
  ...o,
});

export const makeExpense = (o: Partial<Expense> = {}): Expense => ({
  id: testId(),
  amount: cents(50_000),
  spentOn: d("2026-11-02"),
  subcategoryId: testId(),
  bucket: "wants",
  paymentAccountId: null,
  note: null,
  origin: "manual",
  recurringExpenseId: null,
  occurrenceDate: null,
  ...o,
});

export const makeRecurring = (o: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: testId(),
  name: "Rent",
  amount: cents(800_000),
  chargeDay: 1,
  subcategoryId: testId(),
  bucket: "needs",
  paymentAccountId: null,
  startsOn: d("2026-01-01"),
  endedOn: null,
  ...o,
});

export const makeMark = (o: Partial<StatementMark> = {}): StatementMark => ({
  id: testId(),
  cardAccountId: testId(),
  cutOff: d("2026-11-10"),
  ...o,
});

export const makeReceivable = (o: Partial<Receivable> = {}): Receivable => ({
  id: testId(),
  debtorId: testId(),
  cardAccountId: testId(),
  description: "Phone",
  total: cents(1_200_000),
  termMonths: 6,
  purchaseDate: d("2026-11-05"),
  ...o,
});

export const makeInstallment = (o: Partial<Installment> = {}): Installment => ({
  id: testId(),
  receivableId: testId(),
  seq: 1,
  dueOn: d("2026-11-27"),
  cardDueOn: d("2026-11-30"),
  amount: cents(200_000),
  collected: cents(0),
  collectedOn: null,
  status: "pending",
  ...o,
});

export const makeGoal = (o: Partial<Goal> = {}): Goal => ({
  id: testId(),
  kind: "sinking_fund",
  name: "Property tax",
  sourceBucket: "needs",
  targetMonths: null,
  annual: cents(1_200_000),
  monthly: cents(100_000),
  archived: false,
  ...o,
});
