# Data Model: spec 004

Solo se listan los cambios. El esquema base está en `supabase/migrations/0001_schema.sql` y el dominio en `src/domain/types.ts`.

## Base de datos (migración `0008_taxonomy_income_icons.sql`)

### Tipo nuevo `public.income_type`

Enum: `salary`, `gift`, `debt_repayment`, `cashback`, `extra`, `sales`, `savings`, `investment_returns`, `other`. Lista fija, no editable (FR-006).

### `public.incomes`

| Columna | Tipo | Regla |
|---|---|---|
| `income_type` (nueva) | `public.income_type` | `not null default 'other'`. Las filas existentes quedan en `other` (FR-007). |

### `public.categories` y `public.subcategories`

| Columna | Tipo | Regla |
|---|---|---|
| `icon` (nueva, en ambas) | `text` | Nulable. `check (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 40)`. Solo valida formato; la pertenencia al set curado la valida la app (research R5). |

Sin cambios en `unique (user_id, name)` ni en `unique (category_id, name)`: siguen garantizando que el backfill no duplica.

### RPCs (`create or replace`, misma firma, `security invoker`, `search_path = public`)

- `register_income(p_income jsonb, p_allocations jsonb)`: inserta además `income_type = coalesce(nullif(p_income->>'income_type',''),'other')::income_type`.
- `replace_income(p_id uuid, p_income jsonb, p_allocations jsonb)`: actualiza además `income_type` con la misma expresión.

### Función interna `private.apply_taxonomy_004(p_user uuid) returns void`

- Esquema `private` (nuevo, no expuesto por PostgREST); `revoke all on schema private` y `revoke execute` a `public`, `anon`, `authenticated`. `security definer` no es necesario: solo la invoca la migración (rol propietario) y pgTAP.
- Por cada categoría por defecto de research R1: asigna `name_key` e `icon` a la categoría activa del usuario con ese `name` exacto si su `name_key` es nulo o ya es esa clave.
- Inserta `Previous Balances` (`needs`, `taxonomy.categories.previousBalances`, `clock-arrow-left`) y su subcategoría `Previous balances` si el usuario no tiene una categoría con ese nombre.
- Idempotente. No toca subcategorías existentes, categorías archivadas o renombradas, movimientos, recurrentes ni reglas.
- La migración la ejecuta para cada `user_id` distinto de `categories`.

## Dominio (`src/domain`)

### `types.ts`

```ts
type IncomeType = (typeof INCOME_TYPES)[number];   // desde income-types.ts

interface Category    { …; icon: string | null }
interface Subcategory { …; icon: string | null }
interface Income      { …; incomeType: IncomeType }
```

`icon` es `string | null` (no `CategoryIconKey`) porque puede llegar una clave desconocida de la BD; la UI la resuelve con `resolveTaxonomyIcon`.

### `income-types.ts` (nuevo)

`INCOME_TYPES = ["salary","gift","debt_repayment","cashback","extra","sales","savings","investment_returns","other"] as const` — mismo orden que el enum de la BD, que es el orden del selector.

### `icons.ts` (nuevo, puro)

- `CATEGORY_ICON_KEYS`: tupla `as const` del set curado (research R6). `CategoryIconKey` = su unión.
- `isCategoryIconKey(v: unknown): v is CategoryIconKey`.
- `resolveTaxonomyIcon(sub: {icon} | null, category: {icon} | null): CategoryIconKey | "generic"` — subcategoría → categoría → `"generic"`, descartando claves no válidas.

### `default-taxonomy.ts`

```ts
interface DefaultSubcategory { readonly name: string }                 // sin nameKey (Clarificación C)
interface DefaultCategory {
  readonly nameKey: string;   // taxonomy.housing | taxonomy.categories.*
  readonly name: string;      // nombre EN exacto de la nube (emparejado del backfill)
  readonly macro: SpendBucket;
  readonly icon: CategoryIconKey;
  readonly subcategories: readonly DefaultSubcategory[];
}
```

Contenido: la tabla de research R1 (26 categorías, 68 subcategorías). Invariantes (pruebas unitarias): nombres de categoría únicos; nombres de subcategoría únicos dentro de su categoría; 13 `needs` y 13 `wants`; `icon` ∈ `CATEGORY_ICON_KEYS`; cada `nameKey` existe en `en.json` y `es.json`; los `name` coinciden con los del `apply_taxonomy_004` (una prueba compara la lista con un fixture compartido).

## DataProvider (`src/data/provider.ts`)

- `TaxonomyRepository.createCategory` / `createSubcategory`: el input incluye `icon: string | null`.
- `TaxonomyRepository.update(kind, id, patch)`: `patch` admite `icon?: string | null` (`null` quita el ícono propio de una subcategoría). Renombrar sigue borrando `nameKey`; cambiar el ícono no.
- `IncomesRepository.register` / `replace`: el input incluye `incomeType: IncomeType` (requerido).
- Errores: un `icon` con formato inválido → `check_violation` (23514) → `ProviderError('VALIDATION')` (mapeo ya existente en `mappers.ts`).

## i18n (`src/i18n/messages/{en,es}.json`)

- `taxonomy.categories.<clave>` para las 25 categorías nuevas (Housing usa `taxonomy.housing`, ya existente). Las claves planas antiguas se conservan (research R2).
- `income.type.<valor>` para los 9 tipos; `income.typeLabel`, `income.typeRequired`.
- `taxonomy.icon`, `taxonomy.iconPicker`, `taxonomy.iconInherited`, `taxonomy.iconRemove` (selector).
- `common.empty.*` solo si el `EmptyState` lo requiere; los mensajes vacíos actuales de cada página se reutilizan.

## CSV (`src/domain/csv.ts`)

- `incomes.csv`: + `income_type` (valor del enum).
- `categories.csv`, `subcategories.csv`: + `icon`.
