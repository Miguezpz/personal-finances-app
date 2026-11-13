# Contract: dominio del calendario de pagos

Todas las funciones son puras. "Hoy" siempre se inyecta.

## `src/domain/pay-calendar.ts` (nuevo)

```ts
type Paydays = Pick<UserSettings, "firstPayday" | "secondPayday">;

export interface PayCalendar {
  settings: Paydays;
  overrides: ReadonlyMap<PeriodKey, IsoDate>;
}

/** Saturday → Friday (−1), Sunday → Friday (−2); weekdays unchanged. */
export function toPrevFridayIfWeekend(date: IsoDate): IsoDate;

/** Configured payday that funds `period`, clamped, NOT moved: half 2 ← firstPayday of M; half 1 ← secondPayday of M−1. */
export function nominalPayday(period: Period, settings: Paydays): IsoDate;

/** toPrevFridayIfWeekend(nominalPayday(period, settings)). */
export function expectedStart(period: Period, settings: Paydays): IsoDate;

/** Keeps only valid salary overrides (±7 days of expected, strictly between neighbours' expected starts; earliest wins). */
export function buildPayCalendar(settings: Paydays, incomes: readonly Income[]): PayCalendar;

/** `period` with its effective from/to (from = override ?? expected; to = next.from − 1). */
export function withRange(period: Period, cal: PayCalendar): Period;

/** Effective quincena containing `date`, with from/to filled. */
export function periodOfDate(date: IsoDate, cal: PayCalendar): Period;

/** 0 when today is the effective start of its quincena; otherwise days until the next one starts. */
export function daysUntilNextPayday(today: IsoDate, cal: PayCalendar): number;
```

## Cambios en módulos existentes

| Módulo | Antes | Después |
| ------ | ----- | ------- |
| `types.ts` `Period` | `key, start, end, half` | + `from`, `to` |
| `periods.ts` `makePeriod` | — | `from = start`, `to = end` |
| `periods.ts` `fundedPeriodFor` | `(receivedOn)` → siguiente quincena nominal | `(receivedOn, settings)` → quincena con `expectedStart` más cercano (de la anterior, la actual y la siguiente); si empatan, gana la posterior |
| `periods.ts` `daysUntilNextPayday` | `(today, settings)` | se elimina; lo reemplaza el de `pay-calendar.ts` |
| `safe-to-spend.ts` `SafeToSpendInput` | `period` nominal | + `calendar: PayCalendar`; `period` llega con rango efectivo |
| `safe-to-spend.ts` `groupByPeriod` | `periodOf(fecha)` para todo | gastos: `periodOfDate(spentOn, cal)`; asignaciones y aportaciones: `periodOf(periodStart)`; se cortan por `key > upTo.key` |
| `recurring.ts` | `period.start..end` | `period.from..to` (ocurrencias y estado) |
| `spending-by-method.ts` | `period.start..end` | `period.from..to` |
| `net-worth.ts` | `periodOf(asOf)` | `periodOfDate(asOf, buildPayCalendar(s.settings, s.incomes))` + `calendar` |
| `credit.ts` timeline | `clampChargeDay(...)` | `toPrevFridayIfWeekend(clampChargeDay(...))` |
| `payment-sessions.ts` `paydaysIn` | días nominales | `toPrevFridayIfWeekend` de cada uno |
| `features/income/format.ts` `formatPeriodRange` | `(start, locale)` → nominal | `(period, locale)` → `from..to` |

## UI

- **Dashboard** (`data-testid="period-info"`): muestra `t("period", formatPeriodRange(data.period))`. Cuando `data.period.from < nominalPayday(data.period, settings)`, agrega `t("paydayMovedEarly")`:
  - ES: "Pago adelantado al viernes"
  - EN: "Paid early on Friday"
- **Gastos**:
  - La quincena actual es `periodOfDate(today, cal)`.
  - La quincena de la URL pasa por `withRange(periodFromKey(key), cal)`.
  - Anterior y siguiente pasan por `withRange`.
  - `isCurrent` compara claves.
- **Diálogo de ingreso**:
  - Sugiere con `fundedPeriodFor(receivedOn, settings)`.
  - Las opciones muestran rangos efectivos.
  - Sigue siendo editable.
