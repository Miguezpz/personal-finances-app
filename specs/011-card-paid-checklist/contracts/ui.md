# Contract: UI (spec 011)

Todo texto viene de `src/i18n/messages/{en,es}.json`; las llaves nuevas se listan al final. `data-testid` estables para e2e.

## `CardStatementCard` (Crédito `full`, Gastos `compact`)

- Estado del último corte: `paid` ✓ · `nothing` ("Nada que pagar") · `pending` · `overdue`.
- Acción:
  - `pending` / `overdue` → botón **"Ya la pagué"** (`data-testid="mark-paid"`, `aria-label="Ya la pagué: {card}"`, mínimo 44 px de área táctil).
  - `paid` con marca propia en el último corte → botón secundario **"Desmarcar"** (`data-testid="unmark-paid"`).
  - `nothing` → sin acción.
- Se elimina el botón "Pagar" (`pay-card`) y su `openCreate`.

## `PaymentSessionCard` (nuevo, arriba en Crédito) — `data-testid="payment-session"`

- Título: "Sesión de pago" + ventana ("11–13 nov").
- Lista de tarjetas con su marca, fecha límite, estado y la misma acción de `CardStatementCard`.
- `done` → "Sesión completa ✓" + "Siguiente sesión: {ventana}".
- Si hay varias sesiones en el ciclo, se listan en orden (FR-026).
- Sin tarjetas con términos → no se muestra.

## `CardDueAlerts` (Dashboard)

- Si la próxima sesión tiene pendientes y `today ≥ inicio − 7` → bloque `data-testid="session-alert"`:
  - antes de la ventana: "Próxima sesión de pago: {ventana}" + tarjetas pendientes;
  - dentro: "Hoy toca pagar tus tarjetas" + "Ya la pagué" por tarjeta.
- Alertas individuales (`card-alert`) solo para tarjetas fuera de ese bloque, o vencidas.
- El botón "Pagar" de la alerta se cambia por "Ya la pagué".

## Aviso tras marcar / desmarcar

- Marcar: toast "{card} marcada como pagada" con "Deshacer" (6 s).
- Desmarcar: toast "{card} desmarcada" con "Deshacer".
- Error al guardar: se revierte y se muestra el aviso de error habitual. Demo: aviso de solo lectura y sin cambio.

## Eliminado

- `CardPaymentDialog`, `LazyCardPaymentDialog`.
- La entrada "Pagar tarjeta" de la hoja ＋ y de "＋ Nuevo".
- El atajo **P**.
- `payment-row` en Gastos.
- El tipo "Pago de tarjeta" en el filtro de la Bitácora.

## Llaves i18n nuevas (EN / ES)

| Llave                         | EN                                 | ES                                    |
| ----------------------------- | ---------------------------------- | ------------------------------------- |
| `credit.markPaid`             | Mark as paid                       | Ya la pagué                           |
| `credit.markPaidFor`          | Mark {card} as paid                | Ya pagué {card}                       |
| `credit.unmark`               | Unmark                             | Desmarcar                             |
| `credit.unmarkFor`            | Unmark {card}                      | Desmarcar {card}                      |
| `credit.marked`               | {card} marked as paid.             | {card} marcada como pagada.           |
| `credit.unmarked`             | {card} unmarked.                   | {card} desmarcada.                    |
| `credit.stateNothing`         | Nothing to pay                     | Nada que pagar                        |
| `credit.sessionTitle`         | Payment session                    | Sesión de pago                        |
| `credit.sessionWindow`        | {start} – {end}                    | {start} – {end}                       |
| `credit.sessionDone`          | Session complete                   | Sesión completa                       |
| `credit.sessionNext`          | Next session: {window}             | Siguiente sesión: {window}            |
| `credit.sessionHint`          | Pay all your cards in one go between these dates. | Paga todas tus tarjetas en una sola sesión entre estas fechas. |
| `dashboard.sessionUpcoming`   | Next payment session: {window}     | Próxima sesión de pago: {window}      |
| `dashboard.sessionToday`      | Time to pay your cards             | Hoy toca pagar tus tarjetas           |

Se eliminan las llaves sin uso de pago con monto (`expenses.payCard*`, `paidFrom`, `savePayment`, `paymentSaved`, `cardPaymentLabel`, `debtSettlement`, `deletePaymentTitle`, `create.cardPayment`, `ledger.types.card_payment`), con paridad EN/ES probada.
