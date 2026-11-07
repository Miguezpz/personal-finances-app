# Research: Fechas de corte y pago de tarjetas desde el estado de cuenta

**Feature**: [spec.md](spec.md) · **Date**: 2026-11-07

No quedaron `NEEDS CLARIFICATION` en el contexto técnico. Estas son las decisiones de diseño.

## R1. Días inhábiles: módulo propio, sin dependencia

- **Decision**: `src/domain/business-days.ts`, puro:
  - `easterSunday(year)` usa el algoritmo gregoriano anónimo (Meeus/Jones/Butcher).
  - `bankHolidays(year)` devuelve un `ReadonlySet<IsoDate>` y se memoriza por año en un `Map` de módulo.
  - `isBusinessDay(date)`: no es sábado, no es domingo y no es inhábil.
  - `previousBusinessDay(date)`: devuelve `date` si es hábil; si no, retrocede día por día.
- **Lista (FR-009)**:
  - 1 ene;
  - primer lunes de feb;
  - tercer lunes de mar;
  - Jueves Santo (Pascua − 3) y Viernes Santo (Pascua − 2);
  - 1 may;
  - 16 sep;
  - 2 nov;
  - tercer lunes de nov;
  - 12 dic;
  - 25 dic.
- **Rationale**:
  - Son unas 40 líneas, sin red y sin costo (Principio I).
  - Las librerías de feriados (`date-holidays` y similares) pesan decenas de KB.
  - Esas librerías usan el calendario laboral, no el bancario: no incluyen 2 nov ni 12 dic, que son inhábiles para los bancos.
- **Alternatives considered**:
  - **Una tabla de feriados en la base**: necesita mantenimiento anual y una migración por año.
  - **Una API pública de feriados**: es una llamada a un tercero en cada carga y viola el espíritu del Principio V.

## R2. Regla de ajuste: día hábil anterior, solo para el límite

- **Decision**: `dueDateFor(terms, cutOffOn) = previousBusinessDay(addDays(cutOffOn, offset))`.
  - El corte no se ajusta.
  - La fecha de cobro al deudor sigue siendo `cardDueOn − max(1, lead)` y se calcula desde el límite **ya ajustado**.
- **Rationale**:
  - Es la decisión de la spec (Clarifications): nunca mostrar un límite posterior al del banco (SC-004).
  - Cambiar el corte movería compras de un estado a otro, y el dueño no reportó que su banco lo haga.
- **Alternatives considered**:
  - **Día hábil siguiente**: puede mostrar un día después del límite real (en julio, Nu cobró el viernes).
  - **"El más cercano"**: es ambiguo cuando hay varios días inhábiles seguidos.

## R3. Un solo módulo de términos de tarjeta

- **Decision**: crear `src/domain/card-terms.ts`, que reúne todo lo que depende de `(cutOffDay, paymentDueOffsetDays)`:
  - `CardTerms` y `cardTermsOf(account)`;
  - `lastCutOffOn`, que se mueve desde `credit.ts` y sigue reexportada ahí;
  - `nominalDueDate` y `dueDateFor`;
  - `cardTermsFromStatement`;
  - `statementWarnings`;
  - `upcomingStatements`;
  - `latestStatement`.

  Quienes lo usan:
  - `credit.ts`: `cardStatus` y `creditTimeline` usan `dueDateFor`.
  - `installments.ts`: `buildCollectionSchedule` usa `dueDateFor` y expone `installmentDatesFor`.
  - `data/mock/seed.ts`: su `dueFor` pasa a usar `dueDateFor`, para que el demo muestre los mismos límites.
- **Rationale**: es FR-008, un solo lugar para el cálculo. Hoy hay cuatro copias de `addDays(cutOff, offset)`.
- **Alternatives considered**: ajustar solo en la UI. Se descartó porque "vencida" y "pago para no generar intereses" se calculan en el dominio (FR-010).

## R4. Derivar términos de un estado de cuenta

- **Decision**: `cardTermsFromStatement(cutOffOn, dueOn)` funciona así:
  - `cutOffDay` es el día del mes de `cutOffOn`.
  - `paymentDueOffsetDays` es `daysBetween(cutOffOn, dueOn)`.
  - Si `dueOn ≤ cutOffOn`, devuelve el error `dueNotAfterCutOff`.
  - Si la diferencia es de más de 60 días, devuelve el error `dueTooFar`.

  `statementWarnings` devuelve dos avisos:
  - `dueMayHaveMoved`: el día anterior o el siguiente al límite capturado es inhábil.
  - `shortMonthCutOff`: el corte es el último día de un mes de menos de 31 días.
- **Rationale**: con estas reglas, los 6 casos reales de la spec dan exactamente la tabla esperada. Los avisos cubren los dos casos en que un solo estado de cuenta engaña:
  - Nu: corte 23 sep, límite lunes 5 oct. El domingo 4 es inhábil, así que sale `dueMayHaveMoved`.
  - Un corte el 28 de febrero puede ser en realidad un día de corte 29, 30 o 31.
- **Alternatives considered**: pedir dos estados de cuenta para cruzarlos. Es más fricción para un caso raro, y la vista previa ya permite comparar con el siguiente estado.

## R5. Formulario: fechas por defecto y números a mano como opción

- **Decision**: con `kind = credit_card`, `AccountForm` muestra un `CardTermsFields` con dos modos.
  - **Modo "statement"** (por defecto):
    - Dos `<input type="date">`: corte y límite.
    - Un resumen derivado: "Corte el día 22 · vence 15 días después".
    - Los próximos 3 estados.
    - Avisos no bloqueantes.
  - **Modo "manual"**: los dos campos numéricos de hoy, detrás de un enlace "Capturar los números a mano".

  En los dos modos el esquema produce lo mismo: `cutOffDay` y `paymentDueOffsetDays`.

  Al editar, las fechas se prellenan con `latestStatement(terms, today)`: el último corte en o antes de hoy y su límite **nominal**. Así, guardar sin cambios reproduce los mismos números (FR-005).
- **Rationale**:
  - La salida del formulario no cambia, así que la mutación, el CSV y los contratos siguen iguales.
  - El modo manual cubre FR-007 sin otra pantalla.
- **Alternatives considered**: guardar las fechas del estado en la base. Se descartó: la spec dice que no hay cambio de esquema y que el estado de cuenta no se guarda.

## R6. Guardado atómico de tarjeta + mensualidades: RPC `update_account_with_installments`

- **Decision**: migración `0010_update_card_terms.sql` con una función `security invoker`:
  ```text
  update_account_with_installments(p_id uuid, p_patch jsonb, p_installments jsonb) returns accounts
  ```
  En una sola transacción:
  1. Aplica `p_patch` (llaves en snake_case, como las produce `fromAccount`) a la cuenta, con `jsonb_populate_record` sobre la fila actual. Las llaves ausentes no cambian.
  2. Para cada elemento `{id, due_on, card_due_on}` de `p_installments`, actualiza la mensualidad solo si:
     - pertenece a una compra de **esa** tarjeta, y
     - su `status <> 'collected'`.
  3. Si el número de filas actualizadas no es igual al tamaño del arreglo, lanza `23514` y todo se revierte. El repo lo traduce a `ProviderError('VALIDATION')`.

  Así se garantiza FR-012. RLS sigue aplicando porque la función es `security invoker`.

  El repo Supabase usa la RPC solo cuando hay mensualidades que reprogramar; si no, sigue con el `update` directo de hoy.
- **Rationale**:
  - Es el mismo patrón de las RPC atómicas que ya existen: `create_receivable` y `save_distribution_rule`.
  - Las fechas se calculan en el cliente (Principio V); el servidor solo las aplica y valida a quién pertenecen.
- **Alternatives considered**:
  - **Dos escrituras desde el cliente** (cuenta y luego mensualidades): no es atómico.
  - **Calcular las fechas en SQL**: duplica la lógica de días inhábiles en PL/pgSQL y viola el Principio V.

## R7. Recálculo al cambiar la tarjeta y recálculo único de arranque

- **Decision**: una función pura en `card-terms.ts`:
  ```text
  rescheduleCardInstallments(card, receivables, installments, leadDays) → InstallmentDates[]
  ```
  - Para cada mensualidad de la tarjeta con `status <> 'collected'`, recalcula sus fechas con `installmentDatesFor(terms, purchaseDate, seq, lead)`.
  - Devuelve **solo** las que cambian.

  La usan dos lugares:
  1. **`useUpdateAccount`** (FR-011): si el patch cambia `cutOffDay` o `paymentDueOffsetDays`, calcula la lista con los términos nuevos y la manda junto con el patch. La parte optimista también actualiza las mensualidades en el snapshot.
  2. **`useRescheduleInstallments`** (FR-013): un `BackgroundSync` montado en `AppShell`, igual que `useMaterializeRecurring`.
     - `plan`: la primera tarjeta activa con cambios pendientes.
     - `write`: `accounts.update(cardId, {}, changes)`.
     - `merge`: aplica las fechas.

     Al primer arranque después del despliegue corrige la mensualidad existente. Después solo actúa si algo quedó desfasado: un fallo previo, otra pestaña, o un cambio de la anticipación en Ajustes.
- **Rationale**:
  - Principio I: sin cron; la app hace el trabajo al abrirse.
  - Es idempotente: si no hay diferencias, `plan` devuelve `null` y no escribe.
  - En el demo, `useBackgroundSync` no hace nada (`canWrite = false`).
- **Consecuencia aceptada**: si el dueño cambia la anticipación de cobro en Ajustes, las fechas de cobro de las mensualidades pendientes se alinean con la nueva anticipación la siguiente vez que abra la app. Coincide con "con la anticipación configurada" de FR-011.
- **Alternatives considered**: una migración de datos en SQL para el arranque. Necesitaría la regla de días inhábiles en SQL e ids concretos, y el MCP de Supabase prohíbe ids fijos en migraciones.

## R8. Pruebas existentes que cambian

- **Decision**: las pruebas de `credit.test.ts`, `credit-timeline.test.ts` e `installments.test.ts` que esperan un límite en fin de semana o día inhábil se actualizan a la fecha ajustada, con un comentario que lo explica. Las fixtures que no caen en día inhábil no cambian.

  Las e2e que leen fechas del seed del demo se revisan en la fase de pruebas. El seed también cambia, porque usa `dueDateFor`.
- **Rationale**: el cambio de comportamiento es intencional (FR-010). Ocultarlo con fixtures "convenientes" quitaría cobertura.

## Datos reales para pruebas (de la spec, verificados)

Días de la semana verificados con `date`:
- 4 jul 2026 = sábado;
- 4 oct 2026 = domingo;
- 5 dic 2026 = sábado;
- 4 dic 2026 = viernes;
- 25 dic 2026 = viernes.

| Caso | Nominal | Ajustado |
|---|---|---|
| Nu, corte 23 jun + 11 | sáb 4 jul | vie 3 jul |
| Nu, corte 23 sep + 11 | dom 4 oct | vie 2 oct |
| Nu, corte 23 oct + 11 | mar 3 nov | mar 3 nov |
| Banregio, corte 14 nov + 21 (MSI pendiente real) | sáb 5 dic | vie 4 dic; cobro al deudor 1 dic con anticipación 3 |
| BBVA, corte 5 dic + 20 | vie 25 dic (inhábil) | jue 24 dic |
| Pascua 2026 = 5 abr | Jueves Santo 2 abr | Viernes Santo 3 abr |
| Pascua 2027 = 28 mar | Jueves Santo 25 mar | Viernes Santo 26 mar |
