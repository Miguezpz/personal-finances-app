# Research: Quincena según el día real de pago

## R1 — El calendario se deriva y no se guarda

- **Decision**: `buildPayCalendar(settings, incomes)` arma el calendario al vuelo a partir de Preferencias (`firstPayday`, `secondPayday`) y de los ingresos `incomeType === "salary"`.
- **Rationale**:
  - La spec pide no cambiar datos (FR-015).
  - El calendario depende solo de datos que ya están en el snapshot, y recalcularlo es barato.
  - Si se edita o borra un ingreso, el calendario se corrige solo.
- **Alternatives considered**: guardar el inicio efectivo en `incomes` o en una tabla. Se descartó porque requiere migración y podría desincronizarse.

## R2 — Rango efectivo dentro de `Period`, con la clave nominal como identificador

- **Decision**:
  - `Period` gana `from` y `to`. `makePeriod` los llena con `start` y `end`, los valores nominales.
  - `withRange(period, cal)` devuelve el mismo `Period` con el rango efectivo.
  - Los gastos y los cargos recurrentes se filtran con `from..to`.
  - Las asignaciones (`periodStart`) y las aportaciones a metas se agrupan por su clave guardada.
- **Rationale**:
  - El ingreso del viernes 13 ya se guarda con `fundedPeriodStart = 16 nov`, así que la clave nominal identifica bien qué quincena financia.
  - Solo la fecha de los gastos necesita traducirse a una quincena.
  - Con valores por defecto nominales, el código sin calendario (metas, CSV, splitter) no cambia.
- **Alternatives considered**: cambiar `start` y `end` a efectivos. Se descartó porque rompería `isPeriodStart`, el splitter y todo `periodStart` guardado.

## R3 — Inicio esperado y corrección

- **Decision**:
  - La segunda quincena del mes M empieza en `firstPayday` de M (recortado con `clampChargeDay`).
  - La primera quincena de M empieza en `secondPayday` de M−1.
  - `toPrevFridayIfWeekend`: sábado resta 1 día y domingo resta 2.
  - Corrección: el `receivedOn` más temprano de los ingresos `salary` con `fundedPeriodStart = period.start`. Solo cuenta si `|receivedOn − esperado| ≤ 7` y si queda estrictamente entre el inicio esperado de la quincena anterior y el de la siguiente (FR-005). Se compara con los esperados de las vecinas para no tener recursión.
- **Rationale**: se usan las decisiones del dueño del 2026-11-05 y del 2026-11-13 (solo fin de semana, sin feriados). Por eso no se reutiliza `previousBusinessDay` de `business-days.ts`.
- **Alternatives considered**: considerar feriados bancarios. El dueño lo rechazó.

## R4 — `periodOfDate` con pasos hacia la quincena correcta

- **Decision**: se parte de `periodOf(date)` (la quincena nominal):
  - Si la fecha es anterior a su inicio efectivo, se retrocede.
  - Si es igual o posterior al inicio efectivo de la siguiente, se avanza.
  - Se usan bucles `while`, que con la configuración por defecto dan como máximo un paso.
- **Rationale**: es correcto también para días de pago poco comunes (por ejemplo, el 5 y el 20) sin casos especiales.

## R5 — Quién conoce el calendario

- **Decision**:
  - Un hook `usePayCalendar()` en `src/lib/` (al lado de `useToday`) memoiza el calendario sobre `settings` + `incomes`.
  - Lo usan el Dashboard, Gastos e Ingresos.
  - Las funciones de dominio que ya reciben el snapshot (`computeNetWorth`) lo arman ellas mismas.
  - `formatPeriodRange` recibe un `Period` y muestra `from..to`.
- **Out of scope**: los atajos "esta quincena / quincena pasada" de la Bitácora (`ledger-presets.ts`) siguen nominales; la spec no los incluye.

## R6 — Demo

- **Decision**: el seed deposita cada quincena en `toPrevFridayIfWeekend(día nominal)`. `fundedPeriodStart` se sigue calculando con el día nominal.
- **Rationale**: si el seed depositara en domingo, ese `receivedOn` quedaría dentro de ±7 días y movería el inicio al domingo, lo contrario de la regla. Con el reloj fijado en el viernes 13 de nov de 2026, el demo ya tiene el ingreso de ese día.

## R7 — Días al próximo pago y sugerencia de quincena

- **Decision**:
  - `daysUntilNextPayday(today, cal)` vive en `pay-calendar.ts`: es 0 si `today === period.from`; si no, `to − today + 1`.
  - `fundedPeriodFor(receivedOn, settings)` elige, entre la quincena nominal de la fecha, la anterior y la siguiente, la de inicio esperado más cercano. Si hay empate, gana la posterior.
  - El 15 y el último día del mes dan el mismo resultado que hoy. Cambian los fines de semana y los pagos tardíos.
- **Note**: se actualizan `payday.test.ts` y `funded-period.test.ts`. El caso "recibido el día 3 → quincena del 16" pasa a "quincena del 1", porque el pago del mes anterior queda más cerca.

## R8 — Historial

- **Decision**: el arrastre se recalcula con la regla nueva para todas las quincenas. El dueño lo aceptó en la spec (Assumptions).
