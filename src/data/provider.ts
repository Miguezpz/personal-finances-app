/**
 * DataProvider contract (copied from specs/_archive/001-personal-finances-core/contracts/data-provider.ts, T026).
 *
 * Reglas:
 *  - La UI y los hooks solo conocen `DataProvider`; nunca importan `@supabase/*` (regla ESLint).
 *  - `SupabaseProvider` (producción) y `MockProvider` (demo) implementan EXACTAMENTE esta interfaz.
 *  - Toda escritura del `MockProvider` lanza `DemoReadOnlyError`.
 *  - Los proveedores NO calculan lógica de negocio: reciben y devuelven datos ya calculados por `src/domain`.
 *  - Todos los montos viajan como `Cents` (MXN). Ninguna conversión de divisa ocurre aquí.
 */
import type {
  Account,
  CardPayment,
  Category,
  Debtor,
  DistributionRule,
  Expense,
  FinanceSnapshot,
  Goal,
  GoalContribution,
  Income,
  IncomeAllocation,
  Installment,
  IsoDate,
  LedgerEntry,
  NetWorthSnapshot,
  Receivable,
  RecurringExpense,
  Subcategory,
  Uuid,
  UserSettings,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Errores tipados
// ---------------------------------------------------------------------------
export type ProviderErrorCode =
  | "DEMO_READ_ONLY" // MockProvider: cualquier escritura
  | "VALIDATION" // invariante violado (sumas, rangos)
  | "NOT_FOUND"
  | "CONFLICT" // unicidad (p. ej. ocurrencia de fijo ya aplicada)
  | "UNAUTHENTICATED"
  | "OFFLINE"
  | "COLD_START" // base de datos despertando (timeouts/503)
  | "UNKNOWN";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
export class DemoReadOnlyError extends ProviderError {
  constructor(public readonly attempted: string) {
    super("DEMO_READ_ONLY", `Demo is read-only: ${attempted}`);
    this.name = "DemoReadOnlyError";
  }
}

// ---------------------------------------------------------------------------
// Entradas de escritura (sin id ni campos de auditoría)
// ---------------------------------------------------------------------------
export type NewEntity<T extends { id: Uuid }> = Omit<T, "id">;
export type Patch<T extends { id: Uuid }> = Partial<Omit<T, "id">>;

export interface RegisterIncomeInput {
  income: NewEntity<Income>;
  /** Calculadas por `splitIncome()`; Σ amount === income.amount cuando distributed = true. */
  allocations: ReadonlyArray<Omit<IncomeAllocation, "id" | "incomeId">>;
}

export interface CreateReceivableInput {
  receivable: NewEntity<Receivable>;
  /** Calculadas por `buildCollectionSchedule()`; Σ amount === receivable.total. */
  installments: ReadonlyArray<Pick<Installment, "seq" | "dueOn" | "cardDueOn" | "amount">>;
}

export interface SaveRuleInput {
  rule: Omit<DistributionRule, "id">;
}

export interface RecordCollectionInput {
  installmentId: Uuid;
  /** Monto acumulado cobrado (0..amount). El estado se deriva: pending | partial | collected. */
  collected: Installment["collected"];
  collectedOn: IsoDate | null;
}

// ---------------------------------------------------------------------------
// Repositorios por agregado
// ---------------------------------------------------------------------------
export interface SettingsRepository {
  get(): Promise<UserSettings>;
  update(patch: Partial<UserSettings>): Promise<UserSettings>;
}

export interface AccountsRepository {
  list(opts?: { includeArchived?: boolean }): Promise<Account[]>;
  create(input: NewEntity<Account>): Promise<Account>;
  update(id: Uuid, patch: Patch<Account>): Promise<Account>;
  /** Archiva; rechaza (CONFLICT) si hay MSI pendientes asociados a la tarjeta (edge case del spec). */
  archive(id: Uuid): Promise<void>;
}

export interface RulesRepository {
  list(): Promise<DistributionRule[]>;
  /** Guarda regla + sub-reglas de forma atómica (RPC). Σ bps = 10000, sub-reglas = 10000 si investment > 0. */
  save(input: SaveRuleInput): Promise<DistributionRule>;
}

export interface TaxonomyRepository {
  listCategories(): Promise<Category[]>;
  listSubcategories(): Promise<Subcategory[]>;
  createCategory(input: NewEntity<Category>): Promise<Category>;
  createSubcategory(input: NewEntity<Subcategory>): Promise<Subcategory>;
  /**
   * Inserta varias categorías en una sola petición (onboarding, spec 004). Idempotente: las que ya
   * existen con el mismo nombre se ignoran sin error; devuelve solo las creadas.
   */
  insertCategories(inputs: readonly NewEntity<Category>[]): Promise<Category[]>;
  /** Igual para subcategorías: se ignoran las que ya existen en su categoría con el mismo nombre. */
  insertSubcategories(inputs: readonly NewEntity<Subcategory>[]): Promise<Subcategory[]>;
  /**
   * Renombrar limpia `nameKey`: el nombre escrito por el usuario reemplaza la traducción.
   * `icon: null` quita el ícono (una subcategoría vuelve a heredar el de su categoría); cambiar el
   * ícono no toca `nameKey`. Un ícono con formato inválido → ProviderError('VALIDATION').
   */
  update(
    kind: "category" | "subcategory",
    id: Uuid,
    patch: { name?: string; archived?: boolean; icon?: string | null },
  ): Promise<void>;
  /** Rechaza (CONFLICT) si tiene movimientos, salvo reasignación previa. */
  remove(kind: "category" | "subcategory", id: Uuid): Promise<void>;
}

export interface IncomesRepository {
  list(range?: {
    from: IsoDate;
    to: IsoDate;
  }): Promise<{ incomes: Income[]; allocations: IncomeAllocation[] }>;
  /** Atómico (RPC register_income). */
  register(input: RegisterIncomeInput): Promise<Income>;
  /** Reemplaza ingreso y asignaciones de forma atómica; el cliente recalcula con la regla original. */
  replace(id: Uuid, input: RegisterIncomeInput): Promise<Income>;
  remove(id: Uuid): Promise<void>;
}

export interface ExpensesRepository {
  list(range?: { from: IsoDate; to: IsoDate }): Promise<Expense[]>;
  create(input: NewEntity<Expense>): Promise<Expense>;
  update(id: Uuid, patch: Patch<Expense>): Promise<Expense>;
  remove(id: Uuid): Promise<void>;
  /**
   * Inserta por lote las ocurrencias de fijos vencidas. Idempotente: ignora las ya existentes
   * (ON CONFLICT DO NOTHING) y devuelve solo las realmente insertadas.
   */
  materializeRecurring(items: ReadonlyArray<NewEntity<Expense>>): Promise<Expense[]>;
}

export interface RecurringRepository {
  list(): Promise<RecurringExpense[]>;
  create(input: NewEntity<RecurringExpense>): Promise<RecurringExpense>;
  update(id: Uuid, patch: Patch<RecurringExpense>): Promise<RecurringExpense>;
  /** Pausa/termina fijando `endedOn`; no borra el historial aplicado. */
  end(id: Uuid, endedOn: IsoDate): Promise<void>;
  remove(id: Uuid): Promise<void>;
}

export interface CardPaymentsRepository {
  list(range?: { from: IsoDate; to: IsoDate }): Promise<CardPayment[]>;
  create(input: NewEntity<CardPayment>): Promise<CardPayment>;
  remove(id: Uuid): Promise<void>;
}

export interface ReceivablesRepository {
  listDebtors(): Promise<Debtor[]>;
  createDebtor(input: NewEntity<Debtor>): Promise<Debtor>;
  list(): Promise<{ receivables: Receivable[]; installments: Installment[] }>;
  /** Atómico (RPC create_receivable). */
  create(input: CreateReceivableInput): Promise<Receivable>;
  recordCollection(input: RecordCollectionInput): Promise<Installment>;
  remove(id: Uuid): Promise<void>;
}

export interface GoalsRepository {
  list(): Promise<{ goals: Goal[]; contributions: GoalContribution[] }>;
  create(input: NewEntity<Goal>): Promise<Goal>;
  update(id: Uuid, patch: Patch<Goal>): Promise<Goal>;
  /** Idempotente por (goalId, periodStart). */
  addContributions(items: ReadonlyArray<NewEntity<GoalContribution>>): Promise<GoalContribution[]>;
}

export interface NetWorthRepository {
  list(): Promise<NetWorthSnapshot[]>;
  /** Idempotente por mes: si ya existe la instantánea del mes, no hace nada. */
  upsertMonthly(input: NewEntity<NetWorthSnapshot>): Promise<NetWorthSnapshot>;
}

export interface LedgerRepository {
  /** Lectura de la vista de bitácora; el cliente también puede construirla con `buildLedger()`. */
  list(range?: { from: IsoDate; to: IsoDate }): Promise<LedgerEntry[]>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface AuthSession {
  userId: Uuid;
  email: string | null;
}

/**
 * Códigos públicos que la ruta de retorno de OAuth pone en `/?authError=` (002-google-sign-in).
 * `not_authorized`: la cuenta de Google no está asociada al dueño (registro desactivado).
 * `failed`: cualquier otro fallo (cancelación, código ausente/inválido/caducado, red, proveedor).
 */
export type OAuthErrorCode = "not_authorized" | "failed";

export interface AuthPort {
  /** Demo: devuelve siempre una sesión sintética de solo lectura. */
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  /**
   * Inicia el flujo OAuth (PKCE) con Google y NAVEGA fuera de la app: la promesa solo se resuelve si el
   * navegador no llega a salir. `redirectTo` MUST ser `${window.location.origin}/auth/callback`.
   * Demo: rechaza con DemoReadOnlyError("auth.signInWithGoogle").
   */
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  onChange(cb: (session: AuthSession | null) => void): () => void;
}

// ---------------------------------------------------------------------------
// Proveedor
// ---------------------------------------------------------------------------
/**
 * Capacidades del proveedor. La UI y los hooks preguntan por CAPACIDADES, nunca por el tipo de proveedor
 * (Principio IV: los componentes no conocen qué proveedor está activo).
 */
export interface ProviderCapabilities {
  /**
   * false ⇒ el proveedor rechaza toda escritura (MockProvider). Los procesos automáticos en segundo plano
   * (aplicar fijos, aportaciones a metas, instantáneas de patrimonio, onboarding) MUST comprobar esta
   * capacidad y NO ejecutarse ni mostrar avisos cuando es false (FR-047a). Las acciones iniciadas por el
   * usuario siguen intentando escribir y reciben DemoReadOnlyError → toast (FR-047).
   */
  readonly canWrite: boolean;
}

export interface DataProvider {
  /** Informativo (p. ej. DemoBanner); la lógica de negocio y los hooks MUST usar `capabilities`. */
  readonly mode: "live" | "demo";
  readonly capabilities: ProviderCapabilities;
  readonly auth: AuthPort;
  readonly settings: SettingsRepository;
  readonly accounts: AccountsRepository;
  readonly rules: RulesRepository;
  readonly taxonomy: TaxonomyRepository;
  readonly incomes: IncomesRepository;
  readonly expenses: ExpensesRepository;
  readonly recurring: RecurringRepository;
  readonly cardPayments: CardPaymentsRepository;
  readonly receivables: ReceivablesRepository;
  readonly goals: GoalsRepository;
  readonly netWorth: NetWorthRepository;
  readonly ledger: LedgerRepository;
  /** Todo el historial en una sola lectura, para exportar a CSV y para los cálculos derivados. */
  loadSnapshot(): Promise<FinanceSnapshot>;
}

// ---------------------------------------------------------------------------
// Fábrica (src/data/index.ts)
// ---------------------------------------------------------------------------
/**
 * Resuelve el proveedor en tiempo de build según NEXT_PUBLIC_DEMO_MODE.
 * Next.js inlinea la variable, por lo que la rama no usada (y `@supabase/*`) queda fuera del bundle.
 *
 *   export async function createDataProvider(): Promise<DataProvider> {
 *     if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
 *       return (await import('./mock/provider')).createMockProvider();
 *     }
 *     return (await import('./supabase/provider')).createSupabaseProvider();
 *   }
 */
export type CreateDataProvider = () => Promise<DataProvider>;

// ---------------------------------------------------------------------------
// Suite de contrato compartida (tests/contract)
// ---------------------------------------------------------------------------
/**
 * `runDataProviderContract(factory)` se ejecuta contra MockProvider y contra SupabaseProvider (Supabase local):
 *  - lecturas devuelven tipos de dominio válidos (Zod) y datos consistentes (FKs resueltas);
 *  - `loadSnapshot()` es coherente con las lecturas individuales;
 *  - las invariantes (sumas exactas) se rechazan con ProviderError('VALIDATION');
 *  - SOLO en Mock: toda escritura lanza DemoReadOnlyError y no altera el almacén.
 */
export type ProviderContractFactory = () => Promise<{
  provider: DataProvider;
  dispose(): Promise<void>;
}>;
