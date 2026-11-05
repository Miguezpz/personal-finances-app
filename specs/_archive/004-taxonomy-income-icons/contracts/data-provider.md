# Contract delta: DataProvider (spec 004)

Cambios sobre `src/data/provider.ts`. Los dos proveedores (Supabase y mock) MUST cumplirlos, y la suite compartida `tests/contract/data-provider.contract.ts` los verifica contra ambos. `tests/contract/schemas.ts` (zod `strictObject`) se actualiza con los campos nuevos, así que un campo de más o de menos falla la suite.

```ts
// Dominio
type IncomeType =
  | "salary" | "gift" | "debt_repayment" | "cashback" | "extra"
  | "sales" | "savings" | "investment_returns" | "other";

interface Category    { id; name; nameKey: string | null; macro; archived; icon: string | null }
interface Subcategory { id; categoryId; name; nameKey: string | null; archived; icon: string | null }
interface Income      { id; label; amount; receivedOn; fundedPeriodStart; isRecurring; distributed;
                        ruleId; depositAccountId; incomeType: IncomeType }

// TaxonomyRepository
createCategory(input: { name; nameKey; macro; archived; icon: string | null }): Promise<Category>;
createSubcategory(input: { categoryId; name; nameKey; archived; icon: string | null }): Promise<Subcategory>;
update(kind: "category" | "subcategory", id: Uuid,
       patch: { name?: string; archived?: boolean; icon?: string | null }): Promise<void>;

// IncomesRepository — register / replace reciben incomeType (requerido) en el input del ingreso.
```

## Casos de contrato nuevos

| # | Caso | Resultado esperado |
|---|---|---|
| C1 | `createCategory` con `icon: "plug"` y luego `listCategories` | La categoría vuelve con `icon: "plug"` |
| C2 | `update("subcategory", id, { icon: "coffee" })` y luego `{ icon: null }` | Primero `"coffee"`, después `null`; `name` y `nameKey` intactos |
| C3 | `update("category", id, { icon: "Not Valid!" })` | Rechaza con `ProviderError('VALIDATION')` |
| C4 | `update` con `name` nuevo | `nameKey` pasa a `null`; `icon` se conserva |
| C5 | `incomes.register` con `incomeType: "salary"` | El snapshot devuelve el ingreso con `incomeType: "salary"` |
| C6 | `incomes.replace` cambiando a `"gift"` | Tipo actualizado; asignaciones y montos según el input (sin cambios de reparto por el tipo) |
| C7 | Snapshot del demo (mock) | 26 categorías, 68 subcategorías; cada ingreso con un `incomeType` válido |
| C8 | Escrituras en modo demo (`icon`, `incomeType`) | Rechazadas como cualquier escritura del mock en solo lectura (comportamiento existente) |

C3 en el mock: el mock replica el `check` de formato de la BD (`/^[a-z0-9]+(-[a-z0-9]+)*$/`, ≤ 40) para que ambos proveedores se comporten igual.
