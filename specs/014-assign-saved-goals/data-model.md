# Data Model: Usar lo Ahorrado en metas

## Tablas

### `goals` (cambia)

| Columna | Tipo | Cambio |
| ------- | ---- | ------ |
| `kind` | `goal_kind` | el enum gana `purchase` |
| `target_cents` | `bigint`, `check (> 0)` | **nueva**; objetivo de la Compra |
| `due_month` | `date` | ya existía sin uso; ahora es el mes objetivo de la Compra, `check (día = 1)` |
| `completed_at` | `timestamptz` | **nueva**; "Lo compré" |

Forma por tipo (reemplaza el `check` de 0001):

| Tipo | Exige | Prohíbe |
| ---- | ----- | ------- |
| `emergency_fund` | `target_months` | — |
| `sinking_fund` | `annual_cents`, `monthly_cents` | — |
| `purchase` | `target_cents` | `monthly_cents` (FR-008) |

Y `completed_at is null or (archived_at is not null and kind = 'purchase')`.

### `goal_saved_moves` (nueva)

| Columna | Tipo | Regla |
| ------- | ---- | ----- |
| `id` | `uuid` pk | `gen_random_uuid()` |
| `user_id` | `uuid` | `default auth.uid()`, FK `auth.users` cascade |
| `goal_id` | `uuid` | FK `(user_id, goal_id)` → `goals (user_id, id)` **on delete cascade** (FR-014) |
| `moved_on` | `date` | fecha del cliente |
| `amount_cents` | `bigint` | `<> 0`; `+` asignación, `−` regreso |
| `created_at` | `timestamptz` | `default now()` |

- Índice `(user_id, goal_id)`.
- RLS `enable` + `force`, política de dueño (`auth.uid()`), nada para `anon`.
- Privilegios: `select, insert` para `authenticated`; se revoca `update, delete, truncate, references, trigger` (lección de 0012).

## Tipos de dominio (`src/domain/types.ts`)

```ts
export type GoalKind = "emergency_fund" | "sinking_fund" | "purchase";

interface Goal {
  // …lo de hoy
  /** Compra: monto objetivo. */
  target: Cents | null;
  /** Compra: mes objetivo (día 1), informativo. */
  targetMonth: IsoDate | null;
  /** Compra: "Lo compré". Implica archived. */
  completed: boolean;
}

/** Spec 014: Ahorrado → meta (+) o meta → Ahorrado (−). */
interface SavedMove extends Owned {
  goalId: Uuid;
  movedOn: IsoDate;
  amount: Cents; // con signo, ≠ 0
}

interface FinanceSnapshot {
  // …
  savedMoves: readonly SavedMove[];
}
```

## Derivados (no se guardan)

| Valor | Fórmula |
| ----- | ------- |
| Neto de una meta | Σ `amount` de sus movimientos |
| Disponible para asignar | `saved.total − Σ amount` (todas las metas); se muestra `max(·, 0)` + aviso si `< 0` |
| Avance Compra | neto; barra `min(neto / target, 1)` |
| Avance Fondo de emergencia | Σ aportaciones + neto |
| Avance Apartado | Σ aportaciones del año + neto |
| Patrimonio | hoy + `saved.total − Σ neto de metas cumplidas` |

## Estados de una meta

```text
activa ──archivar──▶ archivada ──restaurar──▶ activa
activa ──Lo compré (solo Compra)──▶ cumplida ──restaurar──▶ activa
```

| Estado | Asignar | Regresar | Cuenta en "Disponible" | Resta del patrimonio |
| ------ | ------- | -------- | ---------------------- | -------------------- |
| activa | sí (con ajuste encendido) | sí, hasta el neto | se resta el neto | no |
| archivada | no | sí, hasta el neto | se resta el neto | no |
| cumplida | no | no | se resta el neto | **sí** |

## Validación

- Movimiento: monto > 0 en el formulario; asignar ≤ `max(disponible, 0)`, regresar ≤ neto. El signo lo pone el modo.
- Compra: nombre 1–80, objetivo > 0, mes `YYYY-MM` o vacío.

## Export CSV (`src/domain/csv.ts`)

- `goals.csv`: columnas `target_mxn`, `target_month`, `completed`.
- Nuevo `goal_saved_moves.csv`: `id, goal_id, moved_on, amount_mxn` (con signo).
