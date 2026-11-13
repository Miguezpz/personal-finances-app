/**
 * Domain types (copied from specs/_archive/001-personal-finances-core/contracts/domain-types.ts, T013).
 * Source of truth for UI, the calculation engine and the data providers.
 * SQL row types (database.types.ts) are mapped to these in src/data/supabase/mappers.ts.
 */
import type { IncomeType } from "./income-types";

export type { IncomeType } from "./income-types";

// ---------------------------------------------------------------------------
// Tipos con marca (evitan mezclar centavos, bps, fechas y UUIDs)
// ---------------------------------------------------------------------------
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Entero en centavos de MXN. NUNCA un float. Puede ser negativo (saldos/deudas). */
export type Cents = Brand<number, "Cents">;
/** Entero 0–10000 (100% = 10000). */
export type BasisPoints = Brand<number, "BasisPoints">;
/** Fecha de negocio `YYYY-MM-DD` en la zona horaria del usuario. */
export type IsoDate = Brand<string, "IsoDate">;
/** Identificador de quincena: `YYYY-MM-1` (días 1–15) o `YYYY-MM-2` (día 16–fin). */
export type PeriodKey = Brand<string, "PeriodKey">;
export type Uuid = Brand<string, "Uuid">;

export type Bucket = "needs" | "wants" | "investment";
export type SpendBucket = "needs" | "wants";
export type Locale = "en" | "es";
export type DisplayCurrency = "MXN" | "USD" | "EUR";
export type TrafficLight = "green" | "yellow" | "red" | "neutral";

// ---------------------------------------------------------------------------
// Quincenas
// ---------------------------------------------------------------------------
export interface Period {
  key: PeriodKey;
  /** Primer día de la quincena (día 1 o 16). */
  start: IsoDate;
  /** Último día (15 o fin de mes). */
  end: IsoDate;
  half: 1 | 2;
  /** Inicio efectivo: el día en que llega el pago que la financia (spec 006). Por defecto, start. */
  from: IsoDate;
  /** Fin efectivo: el día anterior al inicio efectivo de la siguiente. Por defecto, end. */
  to: IsoDate;
}

// ---------------------------------------------------------------------------
// Entidades persistidas
// ---------------------------------------------------------------------------
interface Owned {
  id: Uuid;
}

export interface UserSettings {
  timezone: string; // IANA, p. ej. 'America/Mexico_City'
  firstPayday: number;
  secondPayday: number; // 31 = último día del mes
  greenMinBps: BasisPoints; // por defecto 5000
  yellowMinBps: BasisPoints; // por defecto 2000
  collectionLeadDays: number; // por defecto 3
  emergencyFundMonths: number; // por defecto 6
  /** true = el sobrante de cada quincena va a Ahorrado; spec 013. */
  saveSurplus: boolean;
}

export type AccountKind = "checking" | "savings" | "credit_card" | "investment" | "cash";

export interface Account extends Owned {
  kind: AccountKind;
  name: string;
  institution: string | null;
  /** Solo tarjetas de crédito. */
  cutOffDay: number | null;
  /** Días entre el corte y el límite de pago. Solo tarjetas. */
  paymentDueOffsetDays: number | null;
  openingBalance: Cents;
  archived: boolean;
}

export interface InvestmentSubrule {
  accountId: Uuid;
  pct: BasisPoints;
}

export interface DistributionRule extends Owned {
  effectiveFrom: IsoDate;
  needs: BasisPoints;
  wants: BasisPoints;
  investment: BasisPoints;
  /** Suma = 10000 cuando investment > 0. */
  investmentSubrules: readonly InvestmentSubrule[];
}

export interface Category extends Owned {
  name: string;
  /** Clave i18n si es categoría por defecto; null si la creó el usuario. */
  nameKey: string | null;
  macro: SpendBucket;
  archived: boolean;
  /**
   * Clave de ícono (spec 004) o null. Puede traer una clave que esta versión no conoce: se resuelve
   * con `resolveTaxonomyIcon` (src/domain/icons.ts), que cae al genérico.
   */
  icon: string | null;
}

export interface Subcategory extends Owned {
  categoryId: Uuid;
  name: string;
  nameKey: string | null;
  archived: boolean;
  /** Ícono propio (spec 004) o null para heredar el de su categoría. */
  icon: string | null;
}

export interface Income extends Owned {
  label: string;
  amount: Cents;
  receivedOn: IsoDate;
  /** Primer día de la quincena que financia (instantánea). */
  fundedPeriodStart: IsoDate;
  isRecurring: boolean;
  /** false = registrado sin repartir. */
  distributed: boolean;
  ruleId: Uuid | null;
  depositAccountId: Uuid | null;
  /** Tipo de ingreso (spec 004); los anteriores a la feature son "other". */
  incomeType: IncomeType;
}

export interface IncomeAllocation extends Owned {
  incomeId: Uuid;
  bucket: Bucket;
  /** Vehículo de inversión cuando bucket = 'investment'. */
  accountId: Uuid | null;
  amount: Cents;
  periodStart: IsoDate;
}

export interface RecurringExpense extends Owned {
  name: string;
  amount: Cents;
  /** 1–31; en meses cortos se ajusta al último día (FR-009). */
  chargeDay: number;
  subcategoryId: Uuid;
  bucket: SpendBucket;
  paymentAccountId: Uuid | null;
  startsOn: IsoDate;
  /** null = vigente; fecha = pausado/terminado. */
  endedOn: IsoDate | null;
}

export type ExpenseOrigin = "manual" | "recurring";

export interface Expense extends Owned {
  amount: Cents;
  spentOn: IsoDate;
  subcategoryId: Uuid;
  /** Macro heredada de la subcategoría al guardar (instantánea). */
  bucket: SpendBucket;
  paymentAccountId: Uuid | null;
  note: string | null;
  origin: ExpenseOrigin;
  recurringExpenseId: Uuid | null;
  occurrenceDate: IsoDate | null;
}

/** Gasto rápido (spec 005): plantilla que registra un gasto manual con un toque. */
export interface ExpenseTemplate extends Owned {
  /** 1–40 caracteres; se usa como nota del gasto. */
  name: string;
  /** Total por toque, en centavos de MXN, > 0. */
  amount: Cents;
  subcategoryId: Uuid;
  /** null = sin método de pago. */
  paymentAccountId: Uuid | null;
  /** Posición en la fila del Dashboard (0 = primero). */
  sort: number;
  /** true = borrada por el usuario (no se lista). */
  archived: boolean;
}

/**
 * "Ya la pagué" (spec 011): the owner paid the bank statement that closed on `cutOff`. No amount: it
 * settles everything recorded on the card up to that cut-off (and every earlier statement).
 */
export interface StatementMark extends Owned {
  cardAccountId: Uuid;
  cutOff: IsoDate;
}

export interface Debtor extends Owned {
  name: string;
}

export interface Receivable extends Owned {
  debtorId: Uuid;
  cardAccountId: Uuid;
  description: string;
  total: Cents;
  termMonths: number;
  purchaseDate: IsoDate;
}

export type InstallmentStatus = "pending" | "partial" | "collected";

export interface Installment extends Owned {
  receivableId: Uuid;
  seq: number; // 1..termMonths
  dueOn: IsoDate; // cobro sugerido al deudor
  cardDueOn: IsoDate; // límite de pago de la tarjeta
  amount: Cents;
  collected: Cents;
  collectedOn: IsoDate | null;
  status: InstallmentStatus;
}

export type GoalKind = "emergency_fund" | "sinking_fund";

export interface Goal extends Owned {
  kind: GoalKind;
  name: string;
  sourceBucket: Bucket;
  /** Fondo de emergencia: meses de gastos vitales objetivo. */
  targetMonths: number | null;
  /** Apartado: monto anual y retención mensual. */
  annual: Cents | null;
  monthly: Cents | null;
  archived: boolean;
}

export interface GoalContribution extends Owned {
  goalId: Uuid;
  periodStart: IsoDate;
  amount: Cents;
  sourceBucket: Bucket;
}

export interface NetWorthSnapshot extends Owned {
  snapshotOn: IsoDate; // día 1 del mes
  assets: Cents;
  liabilities: Cents;
  netWorth: Cents;
}

// ---------------------------------------------------------------------------
// Valores derivados / vistas (no se persisten)
// ---------------------------------------------------------------------------
/** Spec 011: card payments are no longer money movements (they're "paid" marks), so no "card_payment". */
export type LedgerEntryType = "income" | "expense" | "recurring_expense" | "installment_collection";

export interface LedgerEntry {
  id: Uuid;
  type: LedgerEntryType;
  occurredOn: IsoDate;
  /** Con signo: ingresos/cobros positivos, salidas negativas. En MXN. */
  amount: Cents;
  description: string;
  accountId: Uuid | null;
  bucket: SpendBucket | null;
  /** Subcategoría del gasto (filtro por categoría, FR-042); null para otros movimientos. */
  subcategoryId: Uuid | null;
  /** true = movimiento de terceros (excluido de métricas personales). */
  isThirdParty: boolean;
}

export interface FxSnapshot {
  base: "MXN";
  /** Unidades de la divisa destino por 1 MXN (p. ej. USD: 0.0588). */
  rates: { USD: number; EUR: number };
  /** Fecha de la tasa publicada por la fuente. */
  asOf: IsoDate;
  /** Cuándo se obtuvo en este dispositivo (ISO 8601). */
  fetchedAt: string;
  source: string;
  /** true si proviene de la caché local y no de una consulta exitosa reciente. */
  stale: boolean;
}

/** Todo lo que el cliente necesita para calcular derivados y exportar. */
export interface FinanceSnapshot {
  settings: UserSettings;
  accounts: readonly Account[];
  rules: readonly DistributionRule[];
  categories: readonly Category[];
  subcategories: readonly Subcategory[];
  incomes: readonly Income[];
  allocations: readonly IncomeAllocation[];
  recurring: readonly RecurringExpense[];
  expenses: readonly Expense[];
  statementMarks: readonly StatementMark[];
  debtors: readonly Debtor[];
  receivables: readonly Receivable[];
  installments: readonly Installment[];
  goals: readonly Goal[];
  contributions: readonly GoalContribution[];
  netWorthSnapshots: readonly NetWorthSnapshot[];
  /** Gastos rápidos (spec 005), incluidas las archivadas. */
  expenseTemplates: readonly ExpenseTemplate[];
}
