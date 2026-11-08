# Data Model: Pago de tarjeta como checklist y sesión de pago del mes

## 1. Tabla nueva `public.card_statement_marks` (migración `0011_card_statement_marks.sql`)

| Columna           | Tipo          | Reglas                                                                      |
| ----------------- | ------------- | --------------------------------------------------------------------------- |
| `id`              | `uuid`        | PK, `gen_random_uuid()`                                                     |
| `user_id`         | `uuid`        | `not null default auth.uid()`, FK `auth.users` `on delete cascade`          |
| `card_account_id` | `uuid`        | `not null`; FK compuesta `(user_id, card_account_id) → accounts (user_id, id)` |
| `cut_off`         | `date`        | `not null`; fecha de corte del estado de cuenta pagado                       |
| `marked_at`       | `timestamptz` | `not null default now()`; solo referencia (no se muestra)                    |

- `unique (user_id, card_account_id, cut_off)`: una marca por corte. Marcar dos veces no duplica.
- Índice `(user_id, card_account_id, cut_off)` (lo da el `unique`).
- RLS: las cuatro políticas por dueño (`auth.uid() = user_id`), igual que `0005_rls.sql`. `grant select, insert, delete` a `authenticated`; sin `update`.
- Borrado de cuenta: las marcas se borran con la tarjeta (`on delete cascade` vía la FK compuesta) o el flujo de borrado de cuentas existente las incluye. `supabase/tests/account-deletion.test.sql` se extiende.
- **Conversión** (FR-018), dentro de la misma migración:
  `insert into card_statement_marks (user_id, card_account_id, cut_off) select distinct p.user_id, p.card_account_id, <corte más reciente < p.paid_on según accounts.cut_off_day> from card_payments p join accounts a … where a.cut_off_day is not null on conflict do nothing`.
  - El corte se calcula con `make_date(y, m, least(cut_off_day, días del mes))`.
  - Si ese corte del mes de `paid_on − 1` es mayor que `paid_on − 1`, se usa el del mes anterior (igual que `lastCutOffOn`).
- `card_payments` se conserva sin cambios; la app deja de leerla.

## 2. Dominio (`src/domain/types.ts`)

```ts
export interface StatementMark extends Owned {
  cardAccountId: Uuid;
  cutOff: IsoDate;
}
```

- `FinanceSnapshot.cardPayments` → **se elimina**; se agrega `statementMarks: readonly StatementMark[]`.
- `CardPayment` se elimina de los tipos de la app (solo queda en `database.types.ts` mientras exista la tabla).

## 3. Derivados (sin almacenamiento)

### Estado de cuenta (statement)

| Campo         | Definición                                                                      |
| ------------- | ------------------------------------------------------------------------------- |
| `cutOff`      | `cutOffIn(cutOffDay, mes)`                                                       |
| `due`         | `dueDateFor(terms, cutOff)` (día hábil, spec 007)                                |
| `payRange`    | `[cutOff + 1, due − 1]` (FR-025)                                                 |
| `outstanding` | R3: compras `(L, cutOff]` + cuotas MSI `(due(L), due]`; 0 si `cutOff ≤ L`        |
| `state`       | `paid` · `nothing` · `pending` · `overdue` (R3)                                  |
| `markId`      | id de la marca propia de ese corte, si existe (para "Desmarcar")                 |

`L = paidThrough(card) = max(cutOff de sus marcas)`.

**Transiciones de estado**:

```
            marcar (este corte o uno posterior)
pending ───────────────────────────────────────▶ paid
   │ today > due                                   │ desmarcar / deshacer
   ▼                                               ▼
overdue ─────────── marcar ──────────▶ paid ──▶ pending | overdue (según la fecha)
nothing: sin deuda registrada y sin marca; no tiene acción
```

### Sesión de pago (`PaymentSession`)

| Campo      | Definición                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| `window`   | `{ start, end }`, 1–3 días dentro del cruce (FR-027)                           |
| `cards`    | `{ card, statement }[]`, el estado de cuenta vigente de cada tarjeta del grupo |
| `done`     | todas sus tarjetas `paid` o `nothing`                                          |
| `phase`    | `upcoming` (hoy < inicio) · `today` (inicio ≤ hoy ≤ fin) · `past`             |

## 4. Proveedor de datos (`src/data/provider.ts`)

```ts
export interface StatementMarksRepository {
  list(): Promise<StatementMark[]>;
  /** Idempotente: si ya existe la marca de ese corte, devuelve la existente. */
  create(input: { cardAccountId: Uuid; cutOff: IsoDate }): Promise<StatementMark>;
  remove(id: Uuid): Promise<void>;
}
```

- `DataProvider.cardPayments` → se reemplaza por `DataProvider.statementMarks`.
- Mock: `list` del seed; `create`/`remove` → `denyWrite` (aviso de solo lectura).
- Supabase: `repos/statement-marks.ts`; `create` hace `upsert` con `onConflict: "user_id,card_account_id,cut_off"` e `ignoreDuplicates`, y si no hay fila vuelve a leerla.

## 5. Exportación

- Bitácora CSV: sin filas `card_payment` (FR-020).
- Respaldo ZIP: `card_statement_marks.csv` con `id, card_account_id, cut_off, marked_at`, en lugar de `card_payments.csv`.

## 6. Demo (seed)

- Cada estado de cuenta de cada tarjeta cuya fecha de "pago" (`due − 2`) ya pasó → una marca con su `cutOff` (sustituye a los `cardPayments` del seed).
- El estado de cuenta más reciente con `due − 2 > today` queda sin marcar, así que hay al menos uno pendiente (FR-021).
