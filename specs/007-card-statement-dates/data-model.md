# Data Model: Fechas de corte y pago de tarjetas

**Feature**: [spec.md](spec.md) · **Research**: [research.md](research.md)

**Sin tablas ni columnas nuevas.** Lo único nuevo en la base es la función `update_account_with_installments` (migración `0010`, ver [contracts/data-provider.md](contracts/data-provider.md)).

## Entidades existentes que usa la feature

### Account (tarjeta de crédito), tabla `accounts`

| Campo (dominio) | Columna | Regla |
|---|---|---|
| `cutOffDay` | `cut_off_day` | 1–31; obligatorio si `kind = credit_card` (CHECK existente). En meses cortos se usa el último día (`clampChargeDay`). |
| `paymentDueOffsetDays` | `payment_due_offset_days` | 1–60; obligatorio si `kind = credit_card` (CHECK existente). |

No cambian. Se capturan de otra forma (R5) y alimentan `CardTerms`.

### Installment (mensualidad MSI), tabla `installments`

| Campo | Columna | Cambio |
|---|---|---|
| `cardDueOn` | `card_due_on` | Se recalcula con `dueDateFor` mientras `status <> 'collected'` (FR-011, FR-013). |
| `dueOn` | `due_on` | Se recalcula como `cardDueOn − max(1, collectionLeadDays)` junto con `cardDueOn`. |
| `status` | `status` | Sin cambio. Las mensualidades `collected` nunca se reprograman; las `partial` sí. |

Para recalcular se lee `receivables.purchase_date` y `receivables.card_account_id`, y `installments.seq`.

## Tipos de dominio nuevos (no se guardan)

### `CardTerms`

```text
{ cutOffDay: 1..31, paymentDueOffsetDays: 1..60 }
```
Se obtiene de una cuenta con `cardTermsOf(account)`, que devuelve `null` si la cuenta no es tarjeta configurada.

### `Statement`

```text
{ cutOffOn: IsoDate, dueOn: IsoDate }   // dueOn ya ajustado a día hábil
```
- `upcomingStatements(terms, today, 3)` devuelve los primeros 3 estados cuyo `dueOn ≥ today`.
- `latestStatement(terms, today)` devuelve `{ cutOffOn: lastCutOffOn(day, today), dueOn: nominal }`. Se usa para prellenar el formulario.

### `StatementInput` y su resultado

```text
cardTermsFromStatement(cutOffOn, dueOn) →
  | { ok: true,  terms: CardTerms }
  | { ok: false, error: "dueNotAfterCutOff" | "dueTooFar" }

statementWarnings(cutOffOn, dueOn) → ("dueMayHaveMoved" | "shortMonthCutOff")[]
```

### `InstallmentDates`

```text
{ id: Uuid, dueOn: IsoDate, cardDueOn: IsoDate }
```
Es el resultado de `rescheduleCardInstallments` y la entrada de la RPC. Solo incluye mensualidades cuyas fechas cambian.

### Días inhábiles

`bankHolidays(year): ReadonlySet<IsoDate>` se calcula en el cliente y se memoriza por año; no se guarda (R1).

## Reglas e invariantes

1. `dueDateFor(terms, cutOffOn)` es siempre un día hábil y nunca es posterior a `cutOffOn + offset`.
2. `dueDateFor(terms, cutOffOn) > cutOffOn`.
   - Con offset ≥ 1 y retroceso por días inhábiles, el límite podría caer en el día de corte o antes, por ejemplo con offset 1 y un día siguiente inhábil.
   - Regla: si `previousBusinessDay` llega a `≤ cutOffOn`, se usa el límite nominal sin ajustar.
   - Solo ocurre con offsets de 1–4 días, que en la práctica no existen. Lo cubre una prueba.
3. Para toda mensualidad no cobrada de una tarjeta, después de guardar la tarjeta (o de una pasada del `BackgroundSync`):
   - `card_due_on = dueDateFor(terms, statementCutOff(purchaseDate) + (seq − 1) meses)`;
   - `due_on = card_due_on − max(1, lead)`.
4. La RPC solo modifica mensualidades de la tarjeta indicada que no estén cobradas. Si alguna del arreglo no cumple, no cambia nada (`23514` → `VALIDATION`).
5. Las sumas y los conteos de mensualidades (trigger diferido `trg_installments_sum`) no se afectan: solo cambian fechas.

## Transiciones

- **Tarjeta editada con cambio de términos**: la cuenta y las mensualidades se actualizan en una sola transacción.
- **Tarjeta editada sin cambio de términos**: solo la cuenta, con el `update` directo de hoy.
- **Arranque de la app**: si alguna mensualidad no cobrada no coincide con su cálculo, se reprograma tarjeta por tarjeta.
