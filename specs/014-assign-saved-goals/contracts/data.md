# Contract: datos de movimientos de Ahorrado y metas Compra

## SQL — `supabase/migrations/0014_assign_saved_goals.sql`

Contenido (ver [data-model.md](../data-model.md) para columnas):

1. `alter type public.goal_kind add value if not exists 'purchase';`
2. `goals`: `add column target_cents`, `add column completed_at`, `check` de día 1 en `due_month`.
3. Reemplazar el `check` de forma por tipo de 0001 (nombre autogenerado: buscarlo en `pg_constraint` del local antes de escribir el `drop constraint`). En los `check` nuevos el tipo se compara como `kind::text` (research R2).
4. `create table public.goal_saved_moves` + índice + RLS + privilegios.

Se aplica a la nube con el MCP de Supabase **solo con confirmación del dueño y antes del push** del código que la lee; luego se corrige la versión a `0014` (memoria `migration-before-push`).

pgTAP `supabase/tests/assign-saved-goals.test.sql`:
- `has_table`, RLS forzado, `authenticated` sin `update`/`delete`.
- Una Compra con `target_cents` y sin `monthly_cents` se inserta; con `monthly_cents` falla.
- `completed_at` sin `archived_at` falla; en un Apartado falla.
- Movimiento con monto `0` falla; a la meta de otro usuario falla; otro usuario no lo ve.
- Borrar la meta borra sus movimientos.

## DataProvider (`src/data/provider.ts`)

```ts
interface GoalsRepository {
  list(): Promise<{ goals: Goal[]; contributions: GoalContribution[]; savedMoves: SavedMove[] }>;
  // create / update / addContributions: igual (Goal ya trae target, targetMonth, completed)
  /** Spec 014: una asignación (+) o un regreso (−). */
  addSavedMove(input: NewEntity<SavedMove>): Promise<SavedMove>;
}
```

| Capa | Cambio |
| ---- | ------ |
| `database.types.ts` | `goal_kind` con `purchase`; `goals` con `target_cents`, `completed_at`; tabla `goal_saved_moves` |
| `mappers.ts` | `toGoal` / `fromGoal`: `target`, `targetMonth` (`due_month`), `completed` (`completed_at`); `toSavedMove` |
| `repos/goals.ts` | `list` lee la tabla nueva; `addSavedMove` inserta |
| `supabase/provider.ts` · `mock/provider.ts` · `tests/utils/memory-provider.ts` | `loadSnapshot` incluye `savedMoves`; mock: `addSavedMove: () => denyWrite("goals.addSavedMove")` |
| todo lugar que construye un `FinanceSnapshot` o un `Goal` (fixtures, seed, pruebas) | `savedMoves: []`; `target: null, targetMonth: null, completed: false` |
| `tests/contract/schemas.ts` | `SavedMove`; `Goal` con los campos nuevos |
| `data-provider.contract.ts` | ida y vuelta de una Compra y de `addSavedMove` (+ y −); `savedMove.goalId` existe; rechazo de solo lectura en el demo |
| `csv.ts` | ver data-model |
