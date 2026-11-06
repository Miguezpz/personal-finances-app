# Data Model: Gastos rápidos

## ExpenseTemplate (nueva)

### Dominio (`src/domain/types.ts`)

```ts
export interface ExpenseTemplate extends Owned {
  /** 1–40 caracteres; se usa como nota del gasto. */
  name: string;
  /** Total por toque, en centavos de MXN, > 0. */
  amount: Cents;
  subcategoryId: Uuid;
  /** null = sin método de pago. */
  paymentAccountId: Uuid | null;
  /** Posición en la fila del Dashboard (0 = primero). */
  sort: number;
  /** true = borrada por el usuario (no se lista). */
  archived: boolean;
}
```

`FinanceSnapshot` gana el campo `expenseTemplates: readonly ExpenseTemplate[]`, con todas las filas, incluidas las archivadas.

### Tabla `public.expense_templates` (migración 0009)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `user_id` | uuid | `not null default auth.uid()`, FK `auth.users` `on delete cascade` |
| `name` | text | `check (char_length(name) between 1 and 40)` |
| `amount_cents` | bigint | `check (amount_cents > 0)` |
| `subcategory_id` | uuid | `not null`, FK `(user_id, subcategory_id) → subcategories (user_id, id)` |
| `payment_account_id` | uuid | nulable, FK `(user_id, payment_account_id) → accounts (user_id, id)` |
| `sort` | smallint | `not null default 0`, `check (sort >= 0)` |
| `archived` | boolean | `not null default false` |
| `created_at` / `updated_at` | timestamptz | trigger `set_updated_at` |

Además:
- `unique (user_id, id)`
- Índices: `(user_id, subcategory_id)`, `(user_id, payment_account_id)`, `(user_id, sort) where not archived`.
- RLS: `enable` + `force`, política `expense_templates_owner` (`user_id = (select auth.uid())`), `revoke all from anon, public`, `grant select, insert, update, delete to authenticated`.

### Mapper (`src/data/supabase/mappers.ts`)

- `toExpenseTemplate(row)`: `amount_cents → amount`, `subcategory_id → subcategoryId`, `payment_account_id → paymentAccountId`.
- `fromExpenseTemplate(input)` hace lo inverso. No envía `user_id`; lo pone el default.

## Reglas de validación

| Regla | Dónde |
|---|---|
| Nombre recortado de 1–40 caracteres | zod `expenseTemplateFormSchema` + `check` SQL |
| Monto > 0, capturado con `parseMoneyInput` | zod + `check` SQL |
| Subcategoría obligatoria, no archivada al crear o editar | zod + `SubcategoryOptions` (solo activas) |
| Máximo 12 activas | cliente (`canAddTemplate(templates)`) |
| Subcategoría y cuenta del mismo usuario | FKs compuestas |

## Derivaciones puras (`src/domain/quick-expenses.ts`)

- `activeTemplates(templates)`: las no archivadas, ordenadas por `sort` y luego por `name`.
- `templateAvailability(template, snapshot)`:
  - `{ usable: false, reason: 'subcategoryArchived' }` si su subcategoría está archivada.
  - `{ usable: true, accountDropped: true }` si su cuenta está archivada.
- `templateToExpense(template, snapshot, today)`: devuelve el `NewEntity<Expense>` con:
  - `amount`, `subcategoryId`
  - `bucket` = `bucketOfSubcategory(...)`
  - `paymentAccountId` (null si la cuenta está archivada)
  - `spentOn = today`, `note = name`, `origin = 'manual'`
  - `recurringExpenseId = null`, `occurrenceDate = null`

  Devuelve null si la plantilla no se puede usar.
- `templateFromExpense(input, subcategoryName)`: arma la plantilla de "Guardar como gasto rápido". El nombre es la nota recortada, o el nombre de la subcategoría si la nota está vacía, cortado a 40 caracteres.
- `reorderIds(ids, id, direction)`: mueve un id una posición arriba o abajo.

## Estados

```text
activa ──editar──► activa
activa ──borrar──► archivada (no se lista; los gastos ya creados no cambian)
activa con subcategoría archivada ─► se muestra deshabilitada hasta editarla
```

## Relaciones

- `ExpenseTemplate.subcategoryId` → `Subcategory` (N:1).
- `ExpenseTemplate.paymentAccountId` → `Account` (N:1, opcional).
- Un `Expense` creado por un toque **no** referencia la plantilla (Assumptions de la spec).
