# Contract delta: DataProvider (spec 005)

Cambios sobre `src/data/provider.ts`. Los dos proveedores (Supabase y mock) MUST cumplirlos. La suite compartida `tests/contract/data-provider.contract.ts` los verifica contra ambos, y `tests/contract/schemas.ts` (zod `strictObject`) gana el esquema de `ExpenseTemplate`.

```ts
// Dominio (data-model.md)
interface ExpenseTemplate {
  id: Uuid; name: string; amount: Cents; subcategoryId: Uuid;
  paymentAccountId: Uuid | null; sort: number; archived: boolean;
}

// FinanceSnapshot
expenseTemplates: readonly ExpenseTemplate[];

// Nuevo repositorio
export interface ExpenseTemplatesRepository {
  /** Todas, incluidas las archivadas, ordenadas por sort, name. */
  list(): Promise<ExpenseTemplate[]>;
  create(input: NewEntity<ExpenseTemplate>): Promise<ExpenseTemplate>;
  update(id: Uuid, patch: Patch<ExpenseTemplate>): Promise<ExpenseTemplate>;
  /** Borrado lógico: archived = true. Los gastos no se tocan. */
  remove(id: Uuid): Promise<void>;
  /** sort = índice en `ids` para cada id dado. */
  reorder(ids: readonly Uuid[]): Promise<void>;
}

// DataProvider
readonly expenseTemplates: ExpenseTemplatesRepository;
```

El gasto de un toque usa el `expenses.create` que ya existe. No hay métodos nuevos de gastos.

## Casos de contrato nuevos

| # | Caso | Resultado esperado |
|---|---|---|
| T1 | `create({ name: "Transporte", amount: 2400, subcategoryId, paymentAccountId: null, sort: 0, archived: false })` | Devuelve la fila con `id`; `list()` y `loadSnapshot().expenseTemplates` la incluyen |
| T2 | `update(id, { amount: 3000 })` | `amount: 3000`; los demás campos sin cambios |
| T3 | `remove(id)` | `list()` la devuelve con `archived: true`; los gastos con la misma nota siguen en `expenses` |
| T4 | `reorder([b, a])` | `a.sort = 1`, `b.sort = 0` |
| T5 | `create` con `name` de 41 caracteres o `amount: 0` | Rechaza con `ProviderError('VALIDATION')` |
| T6 | `create` con una `subcategoryId` inexistente | Rechaza (`VALIDATION` o `NOT_FOUND`, igual que con un gasto) |
| T7 | `update` / `remove` con un id inexistente | Rechaza con `ProviderError('NOT_FOUND')` |
| T8 | Snapshot del demo (mock) | Exactamente 1 plantilla activa "Transporte", `amount: 2400`, en la subcategoría "Public transport" |
| T9 | Cualquier escritura de `expenseTemplates` en el mock de demo | Rechaza con `DemoReadOnlyError`, igual que el resto de escrituras del mock |

En el mock, T5 replica los `check` de la BD, para que ambos proveedores se comporten igual.

## SQL (pgTAP, `supabase/tests/`)

- `rls.test.sql`: `expense_templates` entra en la lista de tablas con RLS forzado y política de dueño. Un usuario B no ve ni modifica las plantillas de A.
- `account-deletion.test.sql`: borrar el usuario borra sus plantillas.
- Prueba nueva `expense-templates.test.sql`: los `check` de `name` y `amount_cents`, y la FK compuesta que rechaza la subcategoría de otro usuario.
