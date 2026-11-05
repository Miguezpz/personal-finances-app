/**
 * Contrato: motor de dominio puro (src/domain/*).
 * Reglas: sin React, sin I/O, sin Date.now() implícito (el "hoy" siempre se inyecta),
 * solo aritmética entera. Cada función es determinista y se prueba con Vitest + fast-check.
 */
import type {
  Account,
  BasisPoints,
  Bucket,
  Cents,
  DistributionRule,
  Expense,
  FinanceSnapshot,
  FxSnapshot,
  Goal,
  GoalContribution,
  Income,
  IncomeAllocation,
  Installment,
  IsoDate,
  Period,
  PeriodKey,
  Receivable,
  RecurringExpense,
  SpendBucket,
  TrafficLight,
  DisplayCurrency,
  UserSettings,
  LedgerEntry,
} from './domain-types';

// ---------------------------------------------------------------------------
// money.ts
// ---------------------------------------------------------------------------
/**
 * Reparte `total` según `weights` (bps) con el método de mayor residuo.
 * Invariantes: Σ resultado === total; resultado[i] >= 0; el residuo va a la entrada de mayor peso
 * (empate: la primera en el orden recibido).
 * @throws InvalidWeightsError si Σ weights !== 10000 o total < 0.
 */
export declare function allocateByWeights(
  total: Cents,
  weights: readonly BasisPoints[],
): Cents[];

// ---------------------------------------------------------------------------
// periods.ts
// ---------------------------------------------------------------------------
export declare function periodOf(date: IsoDate): Period;
export declare function periodFromKey(key: PeriodKey): Period;
export declare function nextPeriod(period: Period): Period;
export declare function previousPeriod(period: Period): Period;
/** Últimos día del mes si `day` excede los días del mes (FR-009). */
export declare function clampChargeDay(year: number, month: number, day: number): IsoDate;
/**
 * Quincena sugerida que financia un ingreso: la primera cuyo inicio es estrictamente
 * posterior a `receivedOn` (día 15 → 16 del mismo mes; fin de mes → día 1 siguiente).
 */
export declare function fundedPeriodFor(receivedOn: IsoDate): Period;
/** Días hasta el próximo día de pago configurado (FR-019). */
export declare function daysUntilNextPayday(today: IsoDate, settings: UserSettings): number;
/** "Hoy" en la zona horaria del usuario a partir de un instante. */
export declare function todayIn(timezone: string, now: Date): IsoDate;

// ---------------------------------------------------------------------------
// splitter.ts
// ---------------------------------------------------------------------------
export interface SplitResult {
  /** Una asignación por bolsa (needs, wants) y una por cada vehículo de inversión. */
  allocations: ReadonlyArray<Omit<IncomeAllocation, 'id' | 'incomeId'>>;
  /** Σ allocations.amount === amount (garantizado). */
  total: Cents;
}
/** Regla vigente para una fecha: la de mayor `effectiveFrom` ≤ fecha; null si no hay. */
export declare function effectiveRule(
  rules: readonly DistributionRule[],
  on: IsoDate,
): DistributionRule | null;
/**
 * Distribuye un ingreso: primero entre Needs/Wants/Inversión y luego el rubro de inversión entre sus sub-reglas.
 * @throws RuleNotConfiguredError | InvalidWeightsError
 */
export declare function splitIncome(
  amount: Cents,
  rule: DistributionRule,
  fundedPeriodStart: IsoDate,
): SplitResult;

// ---------------------------------------------------------------------------
// recurring.ts
// ---------------------------------------------------------------------------
export interface RecurringOccurrence {
  recurringExpenseId: RecurringExpense['id'];
  occurrenceDate: IsoDate;
  amount: Cents;
  bucket: SpendBucket;
}
/** Todas las ocurrencias con fecha ≤ today dentro de [starts_on, ended_on] aún no aplicadas (idempotente). */
export declare function dueOccurrences(
  recurring: readonly RecurringExpense[],
  applied: readonly Pick<Expense, 'recurringExpenseId' | 'occurrenceDate'>[],
  today: IsoDate,
): RecurringOccurrence[];
/** Ocurrencias de la quincena aún no aplicadas (fecha > today): se muestran como "pendientes". */
export declare function pendingOccurrences(
  recurring: readonly RecurringExpense[],
  applied: readonly Pick<Expense, 'recurringExpenseId' | 'occurrenceDate'>[],
  period: Period,
  today: IsoDate,
): RecurringOccurrence[];

// ---------------------------------------------------------------------------
// safe-to-spend.ts
// ---------------------------------------------------------------------------
export interface BucketSafeToSpend {
  bucket: SpendBucket;
  /** Arrastre de la quincena anterior (puede ser negativo). */
  carryIn: Cents;
  allocated: Cents;
  fixedApplied: Cents;
  fixedPending: Cents;
  manual: Cents;
  goalContributions: Cents;
  /** carryIn + allocated − fixedApplied − fixedPending − manual − goalContributions. */
  available: Cents;
  /** allocated + max(carryIn, 0); base del porcentaje. */
  base: Cents;
  /** available / base en bps; null si base <= 0. */
  ratio: BasisPoints | null;
  light: TrafficLight;
}

export interface SafeToSpend {
  period: Period;
  needs: BucketSafeToSpend;
  wants: BucketSafeToSpend;
  daysUntilPayday: number;
}

export interface SafeToSpendInput {
  period: Period;
  today: IsoDate;
  settings: Pick<UserSettings, 'greenMinBps' | 'yellowMinBps' | 'firstPayday' | 'secondPayday'>;
  allocations: readonly IncomeAllocation[];
  expenses: readonly Expense[];
  recurring: readonly RecurringExpense[];
  goals: readonly Goal[];
  contributions: readonly GoalContribution[];
}

/**
 * Calcula el Safe-to-Spend de la quincena `period` derivando la cadena de arrastre desde la
 * primera quincena con datos. Los cargos de terceros nunca entran (no son `Expense`).
 */
export declare function computeSafeToSpend(input: SafeToSpendInput): SafeToSpend;
/** Cierre de cada quincena por bolsa (para depuración, gráficas e historial). */
export declare function computeCarryChain(
  input: Omit<SafeToSpendInput, 'period'>,
  upTo: PeriodKey,
): ReadonlyMap<PeriodKey, Record<SpendBucket, Cents>>;
export declare function trafficLight(
  available: Cents,
  base: Cents,
  thresholds: Pick<UserSettings, 'greenMinBps' | 'yellowMinBps'>,
): TrafficLight;

// ---------------------------------------------------------------------------
// installments.ts
// ---------------------------------------------------------------------------
/** N mensualidades iguales; el residuo de centavos va a la última. Σ === total. */
export declare function splitInstallments(total: Cents, termMonths: number): Cents[];
export interface ScheduledInstallment {
  seq: number;
  dueOn: IsoDate; // cobro al deudor = cardDueOn − collectionLeadDays
  cardDueOn: IsoDate; // límite de pago de esa mensualidad
  amount: Cents;
}
/** Genera el calendario (FR-023/024). Siempre dueOn < cardDueOn. */
export declare function buildCollectionSchedule(
  card: Pick<Account, 'cutOffDay' | 'paymentDueOffsetDays'>,
  total: Cents,
  termMonths: number,
  purchaseDate: IsoDate,
  collectionLeadDays: number,
): ScheduledInstallment[];
export declare function debtorBalance(
  installments: readonly Installment[],
  receivables: readonly Receivable[],
  debtorId: Receivable['debtorId'],
): Cents;
export interface CollectionAlert {
  installmentId: Installment['id'];
  debtorId: Receivable['debtorId'];
  amountDue: Cents;
  dueOn: IsoDate;
  /** Negativo = vencido. */
  daysUntilDue: number;
}
/** Cobros vencidos o dentro de `windowDays` (alertas calculadas al abrir la app). */
export declare function collectionAlerts(
  installments: readonly Installment[],
  receivables: readonly Receivable[],
  today: IsoDate,
  windowDays: number, // el llamador pasa COLLECTION_ALERT_WINDOW_DAYS (= 7, constante; FR-025)
): CollectionAlert[];
export declare const COLLECTION_ALERT_WINDOW_DAYS: 7;

// ---------------------------------------------------------------------------
// credit.ts
// ---------------------------------------------------------------------------
export interface CardStatus {
  cardId: Account['id'];
  /** Deuda total = compras directas + saldo pendiente completo de MSI a terceros − pagos. */
  totalDebt: Cents;
  lastCutOff: IsoDate;
  nextPaymentDue: IsoDate;
  /**
   * Monto a pagar para no generar intereses (modo "totalero", FR-029):
   *   compras directas con fecha ≤ lastCutOff
   * + mensualidades de MSI a terceros con cardDueOn === nextPaymentDue (NO las futuras)
   * − pagos de tarjeta con fecha > lastCutOff, mínimo 0.
   */
  payToAvoidInterest: Cents;
}
export declare function cardStatus(
  card: Account,
  snapshot: Pick<FinanceSnapshot, 'expenses' | 'cardPayments' | 'receivables'>,
  today: IsoDate,
): CardStatus;
export interface TimelineEvent {
  date: IsoDate;
  kind: 'payday' | 'card_due' | 'collection_due';
  label: string;
  amount: Cents | null;
}
export declare function creditTimeline(
  snapshot: FinanceSnapshot,
  from: IsoDate,
  to: IsoDate,
): TimelineEvent[];

// ---------------------------------------------------------------------------
// goals.ts / net-worth.ts
// ---------------------------------------------------------------------------
/** Aportaciones de apartados/fondo que faltan por materializar (idempotente por goal+periodo). */
export declare function dueContributions(
  goals: readonly Goal[],
  existing: readonly GoalContribution[],
  today: IsoDate,
): Array<Omit<GoalContribution, 'id'>>;
/** Gastos vitales = promedio mensual de gastos aplicados en Needs de los últimos 3 meses completos (FR-030). */
export declare function emergencyFundProgress(
  goal: Goal,
  contributions: readonly GoalContribution[],
  expenses: readonly Expense[],
  today: IsoDate,
): { saved: Cents; target: Cents; monthsCovered: number };
/**
 * Activos = Σ openingBalance (cuentas que no son tarjeta)
 *         + Σ asignaciones a Inversión
 *         + Σ aportaciones a metas con sourceBucket needs|wants
 *         + Σ mensualidades de terceros pendientes de cobro
 *         + saldo disponible actual de Needs y Wants (con signo).
 * Pasivos = Σ totalDebt de las tarjetas (incluye saldo completo de MSI).
 */
export declare function computeNetWorth(
  snapshot: FinanceSnapshot,
  asOf: IsoDate,
): { assets: Cents; liabilities: Cents; netWorth: Cents };

// ---------------------------------------------------------------------------
// fx.ts
// ---------------------------------------------------------------------------
/** Convierte centavos MXN a la divisa de visualización con redondeo half-up. MXN devuelve el mismo valor. */
export declare function convert(cents: Cents, to: DisplayCurrency, fx: FxSnapshot | null): Cents;
/** Rechaza tasas ≤ 0, no finitas o con variación > maxDeviation vs la previa. */
export declare function isPlausibleRate(
  next: FxSnapshot['rates'],
  previous: FxSnapshot['rates'] | null,
  maxDeviation?: number, // por defecto 0.2
): boolean;

// ---------------------------------------------------------------------------
// ledger.ts / csv.ts
// ---------------------------------------------------------------------------
export interface LedgerFilter {
  from?: IsoDate;
  to?: IsoDate;
  types?: readonly LedgerEntry['type'][];
  accountId?: Account['id'];
  bucket?: Bucket;
  thirdParty?: boolean;
}
export declare function buildLedger(snapshot: FinanceSnapshot): LedgerEntry[];
export declare function filterLedger(entries: readonly LedgerEntry[], filter: LedgerFilter): LedgerEntry[];
/** CSV RFC 4180 con BOM UTF-8; montos en MXN con dos decimales; sin datos convertidos. */
export declare function toCsv(entries: readonly LedgerEntry[]): string;
export declare function snapshotToCsvBundle(snapshot: FinanceSnapshot): Record<string, string>;

// ---------------------------------------------------------------------------
// Errores del dominio
// ---------------------------------------------------------------------------
export declare class InvalidWeightsError extends Error {}
export declare class RuleNotConfiguredError extends Error {}
export declare class InvalidMoneyError extends Error {}
