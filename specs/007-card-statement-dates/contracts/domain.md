# Contract: dominio puro (spec 007)

Las funciones nuevas o cambiadas en `src/domain/`. Ninguna lee el reloj: `today` siempre se inyecta.

## `src/domain/business-days.ts` (nuevo)

```ts
export function easterSunday(year: number): IsoDate;
export function bankHolidays(year: number): ReadonlySet<IsoDate>;   // memorizado por año
export function isBusinessDay(date: IsoDate): boolean;              // no sáb/dom/inhábil
export function previousBusinessDay(date: IsoDate): IsoDate;        // date si ya es hábil
```

## `src/domain/card-terms.ts` (nuevo)

```ts
export interface CardTerms { cutOffDay: number; paymentDueOffsetDays: number }
export interface Statement { cutOffOn: IsoDate; dueOn: IsoDate }
export type StatementError = "dueNotAfterCutOff" | "dueTooFar";
export type StatementWarning = "dueMayHaveMoved" | "shortMonthCutOff";
export interface InstallmentDates { id: Uuid; dueOn: IsoDate; cardDueOn: IsoDate }

export function cardTermsOf(a: Pick<Account, "kind" | "cutOffDay" | "paymentDueOffsetDays">): CardTerms | null;
export function lastCutOffOn(cutOffDay: number, today: IsoDate): IsoDate;     // se mueve desde credit.ts
export function cutOffIn(cutOffDay: number, anyDateInMonth: IsoDate): IsoDate;
export function nominalDueDate(terms: CardTerms, cutOffOn: IsoDate): IsoDate; // cutOffOn + offset
export function dueDateFor(terms: CardTerms, cutOffOn: IsoDate): IsoDate;     // ajustado (R2; invariante 2)

export function cardTermsFromStatement(cutOffOn: IsoDate, dueOn: IsoDate):
  { ok: true; terms: CardTerms } | { ok: false; error: StatementError };
export function statementWarnings(cutOffOn: IsoDate, dueOn: IsoDate): StatementWarning[];
export function upcomingStatements(terms: CardTerms, today: IsoDate, count?: number): Statement[]; // dueOn ≥ today
export function latestStatement(terms: CardTerms, today: IsoDate): Statement;  // dueOn NOMINAL, para prellenar

export function rescheduleCardInstallments(
  card: Account,
  receivables: readonly Receivable[],
  installments: readonly Installment[],
  collectionLeadDays: number,
): InstallmentDates[];   // solo las no cobradas de esa tarjeta cuyas fechas cambian
```

## Cambios en módulos existentes

| Módulo | Cambio |
|---|---|
| `credit.ts` | `cardStatus.nextPaymentDue = dueDateFor(...)`; `creditTimeline` usa `dueDateFor`; `lastCutOffOn` se reexporta desde `card-terms.ts` |
| `installments.ts` | `buildCollectionSchedule` usa `dueDateFor`; nuevo `installmentDatesFor(terms, purchaseDate, seq, lead): { dueOn, cardDueOn }`, que también usa `rescheduleCardInstallments` |
| `data/mock/seed.ts` | `dueFor` = `dueDateFor` (mismo calendario en el demo) |

## Casos de prueba obligatorios (`tests/unit/domain/`)

- **`business-days.test.ts`**:
  - Pascua 2024–2030.
  - Los 11 inhábiles de 2026 y de 2027.
  - Un sábado retrocede al viernes.
  - Desde el sábado de Semana Santa 2026 (4 abr) se retrocede hasta el miércoles 1 abr.
  - El 25 dic 2026 (viernes) retrocede al jueves 24.
- **`card-terms.test.ts`**:
  - La tabla de las 6 tarjetas reales (US1-3).
  - Los casos de Nu de [research.md](../research.md).
  - Los errores `dueNotAfterCutOff` (igual o anterior) y `dueTooFar` (61 días).
  - Los avisos: Nu 23 sep → 5 oct da `dueMayHaveMoved`; un corte el 28 feb 2027 da `shortMonthCutOff`.
  - `upcomingStatements` para BBVA al 7 nov 2026: 5 nov → 25 nov, 5 dic → 24 dic, 5 ene → 25 ene.
  - `latestStatement` produce un ida y vuelta exacto con `cardTermsFromStatement` (FR-005).
  - La invariante 2 (offset 1 antes de un día inhábil).
  - `rescheduleCardInstallments` ignora las cobradas, incluye las parciales y devuelve `[]` cuando todo está al día.
- **`credit.test.ts`, `credit-timeline.test.ts`, `installments.test.ts`**: las expectativas que caían en día inhábil se ajustan (R8).
