# Research: Pago de tarjeta como checklist y sesión de pago del mes

## R1 · Dónde vive la marca: tabla nueva `card_statement_marks`

- **Decision**: tabla nueva `card_statement_marks (id, user_id, card_account_id, cut_off, marked_at)`, única por `(user_id, card_account_id, cut_off)`, con RLS y FK compuesta `(user_id, card_account_id) → accounts`, igual que el resto del esquema. Sin monto.
- **Rationale**: una marca no es un pago. Reusar `card_payments` con `amount_cents` nulo rompería su `check (amount_cents > 0)`, la vista `ledger` y el CSV, y mezclaría dos significados. Una tabla propia con unicidad hace que marcar dos veces sea idempotente (`on conflict do nothing`).
- **Alternatives considered**:
  - Columna `paid_through` en `accounts`. Se descartó porque no permite desmarcar al estado anterior (FR-006/007) sin guardar historial.
  - Seguir con `card_payments` y calcular el monto de la marca. Se descartó porque vuelve a generar saldo a favor si cambian las compras registradas.

## R2 · Semántica: "pagado hasta" = la marca más reciente

- **Decision**: para cada tarjeta, `paidThrough = max(cut_off)` de sus marcas. Un corte con fecha `≤ paidThrough` está pagado. Lo registrado con fecha `≤ paidThrough` (compras) o con `cardDueOn ≤ due(paidThrough)` (cuotas MSI) está cubierto.
- **Rationale**: cumple FR-004 (marcar el último liquida los anteriores) sin escribir marcas implícitas. Desmarcar el último deja que el máximo vuelva a la marca anterior (edge case "desmarcar un corte que cubría a otros"). Una compra registrada tarde dentro de un corte pagado queda cubierta, sin reabrirlo.
- **Alternatives considered**: marcas independientes por corte. Se descartó porque un corte anterior sin marcar seguiría vencido aunque el banco ya lo cobró dentro del estado de cuenta siguiente.

## R3 · Fórmulas nuevas de `credit.ts`

Con `L = paidThrough(card)` (o "nunca") y `due(·)` = `dueDateFor` (spec 007):

- **A pagar en el corte C** (`C > L`): compras con `L < spentOn ≤ C` + cuotas MSI con `due(L) < cardDueOn ≤ due(C)`. Si `C ≤ L`, el corte está pagado.
- **Deuda total**: compras con `spentOn > L` (incluye el periodo abierto) + cuotas MSI con `cardDueOn > due(L)`.
- **Estado del último corte**: `paid` si `C ≤ L`; `overdue` si `today > due(C)`; si no, `pending`, aunque el monto registrado sea 0. Al principio había un estado `nothing` para monto 0; se retiró el 2026-11-08 porque la familia compra con las tarjetas sin registrarse.
- **Siguiente corte**: lo que agrega entre el corte actual y el siguiente, como hoy (supone que el actual se paga).
- **Rationale**: los pagos dejan de restar, así que no puede haber saldo a favor (FR-005, FR-019). Las cuotas MSI se asignan por `cardDueOn`, que el spec 007 ya ajusta a día hábil.
- **Alternatives considered**: conservar `payments` como resta opcional. Se descartó porque la spec elimina los montos de pago (FR-010).

## R4 · Conversión de pagos anteriores (FR-018, FR-032)

- **Decision**: la conversión va en la migración `0011`, en SQL, con la misma regla que la función de dominio `markForLegacyPayment`: cada pago marca el corte `lastCutOffOn(cutOffDay, paid_on − 1 día)`, es decir, el corte más reciente estrictamente anterior a la fecha del pago. Se inserta con `on conflict do nothing` (varias conversiones sobre un corte dejan una marca). La tabla `card_payments` no se borra; deja de leerse.
- **Revisión previa (FR-032)**: antes de aplicar `0011` a la nube se ejecuta en solo lectura la misma consulta de selección (`supabase/queries/preview-card-marks.sql`) y se le muestra al dueño la lista tarjeta → cortes marcados. La migración se aplica solo con su aprobación.
- **Rationale**: SQL deja la conversión atómica y verificable con pgTAP. La función de dominio permite probar la misma regla en unitarias y usarla en el seed del demo.
- **Alternatives considered**:
  - Conversión en el cliente con `BackgroundSync`. Se descartó porque correría sin revisión previa y dependería de que el dueño abra la app.
  - Borrar `card_payments`. Se pospone a un cambio futuro, cuando la conversión esté verificada (Assumptions).

## R5 · Sesión de pago: agrupación mínima por cruce de rangos

- **Decision**: función pura `paymentSessions(cards, data, settings, today)`:
  1. Por tarjeta activa con términos, su **estado de cuenta vigente**: el primero cuyo rango de pago `[corte+1, due−1]` termina hoy o después.
  2. Agrupación mínima de intervalos por "estacado" voraz (ordenar por fin de rango; abrir grupo en el menor fin; unir todos los que empiezan antes o en ese punto). Es óptimo para cubrir intervalos con el menor número de puntos (FR-026).
  3. Por grupo, cruce `[max inicios, min fines]` y ventana de `min(3, largo del cruce)` días según FR-027: si un día de pago (`firstPayday`, `secondPayday` con 31 = último día) cae en el cruce, la ventana incluye el primero y empieza en él, o termina en el fin del cruce si no cabe. Si no cae ninguno, empieza al inicio del cruce.
  4. Estado de la sesión: `done` si todas sus tarjetas están `paid`. La **próxima sesión** (FR-028) es la primera con ventana que termina hoy o después y no está `done`. Si todas están `done`, se calcula el ciclo siguiente con el estado de cuenta posterior de cada tarjeta.
- **Rationale**: es determinista y barato (≤ 6 tarjetas), se calcula en el cliente sin guardar nada (FR-031) y usa las mismas fechas ajustadas del spec 007.
- **Alternatives considered**: buscar la combinación de ciclos que dé una sola sesión moviendo tarjetas al mes siguiente. Se descartó porque podría proponer pagar un estado de cuenta después de su fecha límite.

## R6 · Aviso del Dashboard (FR-029)

- **Decision**: `CardDueAlerts` calcula primero la próxima sesión. Si `today ≥ inicio − 7` y la sesión tiene pendientes, muestra un bloque de sesión: "Próxima sesión de pago" antes de la ventana, o "Hoy toca pagar tus tarjetas" dentro de ella, con un "Ya la pagué" por tarjeta pendiente. Las tarjetas de esa sesión no tienen alerta individual, salvo las vencidas. El resto de las tarjetas conserva su alerta individual (7 días o vencida).
- **Rationale**: un solo lugar decide qué alertas se ven, así que no hay duplicados.

## R7 · Marcar y desmarcar con Deshacer

- **Decision**: `useMarkStatementPaid` y `useUnmarkStatement` con `useSnapshotMutation` (optimista, con reversión si falla). El aviso de 6 s (`UNDO_TOAST_MS`) usa el patrón de `useQuickExpense`: Deshacer espera la promesa de la escritura y aplica la operación contraria. El demo rechaza la escritura con su aviso global antes de cambiar nada (`useCanWrite`).
- **Rationale**: es el mismo patrón que la app ya usa para escrituras de un toque con Deshacer (spec 005/009). No hace falta `pending-deletes`, porque marcar no oculta una fila.

## R8 · Lo que se elimina

- `CardPaymentDialog`, `LazyCardPaymentDialog`, `schemas` de pago, `create-actions` "card-payment", el atajo P, la entrada de `DialogHost` y el `kind` de `store/ui`.
- Las filas `payment-row` de Gastos, el tipo `card_payment` de la bitácora (dominio y filtros) y `card-payment` de `use-deferred-delete`.
- `cardPayments` sale del `FinanceSnapshot`, de `DataProvider` y del mock. El repo Supabase `card-payments.ts` se borra.
- En el CSV, la bitácora ya no tiene pagos y el respaldo cambia `card_payments.csv` por `card_statement_marks.csv`.
- La vista SQL `ledger` no se usa en la app (la bitácora se arma en el dominio), así que no se toca en esta migración.

## R9 · Pruebas sin Docker en la sesión

- **Decision**: las unitarias (dominio, hooks, componentes) y los e2e del demo corren sin Docker. pgTAP (`card-statement-marks.test.sql`) y el contrato contra Supabase local requieren Docker. Se intentará levantarlo para la verificación final; si no está disponible, quedan escritos y se reporta (como en specs anteriores).
