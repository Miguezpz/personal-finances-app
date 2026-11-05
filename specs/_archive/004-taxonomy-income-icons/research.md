# Research: Taxonomía completa, tipos de ingreso e íconos (spec 004)

Fuentes: spec 004, plan previo `~/.claude/plans/entonces-comencemos-a-planear-compiled-abelson.md`, el código en `main` (2026-11-05) y una consulta de solo lectura a la nube (`potodtpkgadgsmeuuafx`) con los nombres de categorías y subcategorías.

## R1. Taxonomía de referencia (estado real de la nube)

**Hallazgo**: la cuenta del dueño tiene **25 categorías activas y 69 subcategorías activas**, no 80. Las ~13 restantes pertenecen a las 7 categorías genéricas archivadas (`Food`, `Health`, `Transport`, `Dining out`, `Entertainment`, `Fitness`, `Shopping`), que conservan su `name_key` y sus subcategorías con clave. `Housing` es la única activa con `name_key` (`taxonomy.housing`) y mezcla 3 subcategorías con clave (`Rent`, `Utilities`, `Internet & phone`) con 2 sin clave (`Maintenance`, `Property tax`).

**Decision**: `DEFAULT_TAXONOMY` pasa a estas 26 categorías (orden: Needs y luego Wants). El nombre guardado (`name`) es el inglés exacto de la nube, para que el backfill pueda emparejar por nombre.

| # | Categoría (name) | Bucket | nameKey | Ícono | ES (propuesta, a revisar) | Subcategorías (EN, sin traducir) |
|---|---|---|---|---|---|---|
| 1 | Housing | needs | `taxonomy.housing` (existente) | `house` | Vivienda | Rent, Maintenance, Property tax |
| 2 | Home Services | needs | `taxonomy.categories.homeServices` | `plug` | Servicios del hogar | Electricity, Gas, Internet, Water |
| 3 | Telecom | needs | `taxonomy.categories.telecom` | `smartphone` | Telefonía | Mobile data, Mobile plan |
| 4 | Transport & Gas | needs | `taxonomy.categories.transportGas` | `car` | Transporte y gasolina | Fuel, Public transport, Rideshare (Uber/DiDi), Tolls |
| 5 | Groceries | needs | `taxonomy.categories.groceries` | `shopping-cart` | Despensa | Cleaning supplies, Hygiene, Pantry |
| 6 | Health & Insurance | needs | `taxonomy.categories.healthInsurance` | `heart-pulse` | Salud y seguros | Doctor, Insurance, Medicine |
| 7 | Gym & Wellness | needs | `taxonomy.categories.gymWellness` | `dumbbell` | Gimnasio y bienestar | Equipment, Gym, Supplements |
| 8 | Fixed Subscriptions | needs | `taxonomy.categories.fixedSubscriptions` | `repeat` | Suscripciones fijas | Cloud storage, Software |
| 9 | Maintenance & Contingencies | needs | `taxonomy.categories.maintenance` | `wrench` | Mantenimiento e imprevistos | Car repairs, Home repairs |
| 10 | Education & Development | needs | `taxonomy.categories.education` | `graduation-cap` | Educación y desarrollo | Books, Certifications, Courses |
| 11 | Bank Fees & Taxes | needs | `taxonomy.categories.bankFees` | `landmark` | Comisiones e impuestos | Annual card fee, Bank fees, Taxes |
| 12 | Pets | needs | `taxonomy.categories.pets` | `paw-print` | Mascotas | Pet food, Vet |
| 13 | Previous Balances | needs | `taxonomy.categories.previousBalances` | `clock-arrow-left` | Saldos anteriores | Previous balances |
| 14 | Restaurants & Cafes | wants | `taxonomy.categories.restaurants` | `utensils` | Restaurantes y cafés | Coffee, Food delivery, Restaurants |
| 15 | Entertainment & Leisure | wants | `taxonomy.categories.entertainment` | `ticket` | Entretenimiento y ocio | Bars, Cinema, Concerts, Video games |
| 16 | Streaming | wants | `taxonomy.categories.streaming` | `tv` | Streaming | Music streaming, Video streaming |
| 17 | Clothes & Shoes | wants | `taxonomy.categories.clothes` | `shirt` | Ropa y calzado | Accessories, Clothing, Shoes |
| 18 | Personal Care | wants | `taxonomy.categories.personalCare` | `scissors` | Cuidado personal | Barbershop, Fragrance, Skincare |
| 19 | Gifts & Commitments | wants | `taxonomy.categories.gifts` | `gift` | Regalos y compromisos | Anniversaries, Birthdays |
| 20 | Pocket Money / Snacks | wants | `taxonomy.categories.pocketMoney` | `candy` | Gastos hormiga y antojos | Convenience store, Drinks, Snacks |
| 21 | Tech & Gadgets | wants | `taxonomy.categories.tech` | `headphones` | Tecnología y gadgets | Audio, Cables & accessories, Cases |
| 22 | Travel & Getaways | wants | `taxonomy.categories.travel` | `plane` | Viajes y escapadas | Flights, Lodging, Trips |
| 23 | Home & Furniture | wants | `taxonomy.categories.homeFurniture` | `sofa` | Hogar y muebles | Appliances, Decor, Furniture |
| 24 | Hobbies & Sports | wants | `taxonomy.categories.hobbies` | `palette` | Pasatiempos y deportes | Hobbies, Sports |
| 25 | Donations | wants | `taxonomy.categories.donations` | `hand-heart` | Donativos | Donations |
| 26 | Other | wants | `taxonomy.categories.other` | `ellipsis` | Otros | Uncategorized |

Totales del default: 13 Needs + 13 Wants y **68 subcategorías** (35 en Needs, 33 en Wants): las 69 activas de la nube, menos `Utilities` e `Internet & phone` de Housing (ver nota), más `Previous balances`.

**Nota sobre Housing (decisión a confirmar por el dueño)**: en la nube Housing conserva `Utilities` e `Internet & phone` de la taxonomía genérica antigua, que se solapan con `Home Services` y `Telecom`. El **default** para cuentas nuevas y el demo los omite (Housing = Rent, Maintenance, Property tax). La cuenta del dueño **no se toca**: sigue teniendo las 5 subcategorías y puede archivar las 2 sobrantes desde la app si quiere.

**Rationale**: claves nuevas bajo `taxonomy.categories.*` para no chocar con las claves planas existentes (`taxonomy.streaming`, `taxonomy.groceries`, `taxonomy.restaurants`… ya significan subcategorías antiguas y siguen en uso por las filas archivadas y por el historial). Housing conserva su clave porque la fila del dueño ya la tiene.

**Alternatives considered**: reutilizar las claves planas (colisiona con subcategorías antiguas); borrar las claves antiguas de los diccionarios (rompería la traducción de las categorías archivadas y del historial del ledger).

## R2. Subcategorías sin traducción (Clarificación C)

**Decision**: las subcategorías del nuevo default se crean con `nameKey = null` y se muestran con su nombre guardado. Las claves planas antiguas (`taxonomy.rent`, `taxonomy.gym`, …) **se conservan** en `en.json`/`es.json`: las usan las filas existentes (las 3 de Housing y las de las categorías archivadas), y `useTaxonomyName` ya cae al nombre guardado si una clave falta.

**Consecuencia en el código**: dos sitios identifican subcategorías por `nameKey` y deben pasar a identificarlas por nombre dentro de su categoría:
- `runOnboarding` (`src/features/settings/onboarding.ts`) deduplica subcategorías con `existing.has(sub.nameKey)`; con claves nulas se saltaría todas. Pasa a deduplicar por `name`.
- `subcategoryId(nameKey)` del catálogo mock (`src/data/mock/fixtures/catalog.ts`) y sus ~17 usos en `seed.ts`. Pasa a `subcategoryId(categoryKey, subName)`.

**Alternatives considered**: dar `nameKey` a las subcategorías pero dejar los textos en inglés en ambos diccionarios (duplica 66 entradas sin valor y contradice la clarificación).

## R3. Backfill de la cuenta existente (FR-003, FR-004)

**Decision**: la migración `0008` define una función interna `private.apply_taxonomy_004(p_user uuid)` en un esquema **no expuesto** por PostgREST, con `execute` revocado a `public`, `anon` y `authenticated`. La migración la llama para cada usuario que ya tiene al menos una categoría. La función:
1. Para cada categoría por defecto, `update categories set name_key = <clave>, icon = <ícono> where user_id = p_user and name = <name> and archived_at is null and (name_key is null or name_key = <clave>)`. Housing (que ya tiene `taxonomy.housing`) solo recibe el ícono. Las categorías renombradas o archivadas no se tocan (edge cases del spec).
2. Si el usuario no tiene ninguna categoría llamada `Previous Balances`, la inserta (`macro = needs`, su clave e ícono) con la subcategoría `Previous balances`. `on conflict do nothing` sobre `unique(user_id, name)` la hace idempotente.
3. No toca subcategorías existentes, movimientos, recurrentes, saldos ni reglas.

**Rationale**: una función permite probar el backfill con pgTAP (insertando un usuario de prueba con la taxonomía de la nube y llamándola dos veces para comprobar idempotencia) sin duplicar el SQL. Al no estar en `public`, ningún cliente puede invocarla.

**Alternatives considered**: `update` sueltos en la migración (no se pueden probar: pgTAP corre sobre una base sin usuarios); rellenar desde el cliente en el onboarding (hoy solo corre con 0 categorías, y cambiarlo haría que cada inicio de sesión escriba).

## R4. Tipo de ingreso en la base de datos (FR-006 a FR-010)

**Decision**:
- `create type public.income_type as enum ('salary','gift','debt_repayment','cashback','extra','sales','savings','investment_returns','other')`.
- `alter table incomes add column income_type public.income_type not null default 'other'` → los ingresos existentes quedan en `other` (FR-007).
- `create or replace` de `register_income` y `replace_income` con la misma firma, `security invoker` y `search_path`, leyendo `coalesce(nullif(p_income->>'income_type',''), 'other')::public.income_type`. Los permisos de `0005` se conservan con `create or replace`.
- La obligatoriedad (Clarificación B) vive en el **formulario** y en el contrato del `DataProvider` (`incomeType` requerido en el tipo de dominio). El `coalesce` del RPC solo protege el intervalo entre aplicar `0008` en la nube y desplegar el frontend nuevo: el frontend antiguo sigue funcionando.
- La vista `ledger_entries` **no** cambia: el spec no pide el tipo en el ledger, y el CSV se genera del snapshot (`src/domain/csv.ts`), no de la vista.

**Alternatives considered**: tabla de tipos editable (fuera de alcance); `check` sobre `text` (el enum documenta mejor los valores y genera la unión en `database.types.ts`); RPC estricta sin `coalesce` (rompe el frontend antiguo durante el despliegue).

## R5. Columna de ícono (FR-011)

**Decision**: `categories.icon text null` y `subcategories.icon text null` con `check (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 40)`. La base solo valida el **formato**; pertenecer al conjunto curado lo valida zod en el editor (FR-012) y la UI cae al genérico si llega una clave desconocida (edge case). Así añadir íconos al set no requiere migración.

**Alternatives considered**: enum de íconos en la BD (cada ícono nuevo sería una migración); sin `check` (permitiría basura en una columna que viaja al cliente).

## R6. Íconos: mapa estático y resolución (FR-011 a FR-017)

**Decision**:
- `src/domain/icons.ts` (puro, sin React): `CATEGORY_ICON_KEYS` (tupla `as const` con ~40 claves kebab-case), el tipo `CategoryIconKey`, `isCategoryIconKey()` y `resolveTaxonomyIcon(sub, category) → CategoryIconKey | "generic"` con el orden de la Clarificación A: ícono de la subcategoría → de su categoría → genérico (también si la clave no es válida).
- `src/components/icons/category-icons.ts`: `const CATEGORY_ICONS = { house: House, plug: Plug, … } satisfies Record<CategoryIconKey, LucideIcon>` con **imports nombrados**. `satisfies` hace que TypeScript falle si una clave del dominio no tiene componente. Prohibido `import * as icons` o `icons[name]` dinámico.
- `src/components/icons/CategoryIcon.tsx`: recibe la clave ya resuelta, pinta el componente con `aria-hidden`, `size-4` y `text-muted-foreground`.
- Los mapas de las superficies de FR-014 (`ACCOUNT_KIND_ICONS`, `BUCKET_ICONS`, `LEDGER_TYPE_ICONS`, `RECEIVABLE_STATUS_ICONS`, `GOAL_KIND_ICONS`, `INCOME_TYPE_ICONS`) viven en `src/components/icons/` con el mismo patrón, siguiendo el `ICONS` existente de `src/features/credit/CreditTimeline.tsx`.
- Los 40 íconos de categoría solo se importan desde páginas que los muestran (taxonomía, gastos, ledger, recurrentes, ingresos), no desde `/` ni `/dashboard`; el dashboard solo suma los de bucket y del encabezado. Se mide con `scripts/measure-first-load.mjs` antes y después (SC-005: < 5 KB gzip).

**Íconos verificados** contra `lucide-react` 1.66 instalado: todos los de la tabla R1 y de FR-014 existen. `History` no existe en esta versión; Previous Balances usa `ClockArrowLeft`.

**Set curado (~40)**: los 26 de R1 más alternativas útiles para categorías del dueño: `coffee`, `music`, `book-open`, `baby`, `fuel`, `bus`, `bike`, `gamepad-2`, `film`, `receipt-text`, `tag`, `store`, `briefcase`, `piggy-bank`, `shapes` (genérico).

## R7. Selector de tipo de ingreso (FR-008, Clarificación B)

**Decision**: un **grupo de opciones** (el `RadioGroup` de shadcn ya presente en `src/components/ui/radio-group.tsx`) con 9 opciones en cuadrícula, cada una con ícono y nombre, sin valor inicial en el formulario de alta. zod: `incomeType: z.enum(INCOME_TYPES, { message: "typeRequired" })` con valor por defecto `""` en el formulario, de modo que guardar sin elegir muestra `income.typeRequired` junto al campo. Al editar, el grupo carga el tipo guardado. Al elegir un tipo con la etiqueta vacía, la etiqueta se rellena con el nombre traducido del tipo (sin pisar texto ya escrito).

**Rationale**: los `<select>` nativos no admiten íconos; un `Select` de Radix añadiría dependencia al bundle de la página de ingresos; el `RadioGroup` ya existe, es accesible con teclado y deja ver las 9 opciones de un vistazo (un clic).

Íconos por tipo: salary `briefcase`, gift `gift`, debt_repayment `hand-coins`, cashback `badge-percent`, extra `circle-plus`, sales `store`, savings `piggy-bank`, investment_returns `trending-up`, other `ellipsis`. ES: Salario, Regalo, Pago de deuda, Cashback, Extra, Ventas, Ahorros, Rendimientos de inversión, Otro.

## R8. CSV (FR-010)

**Decision**: `incomes.csv` añade la columna `income_type` con el valor del enum (estable, en inglés snake_case, como el resto de cabeceras). `categories.csv` y `subcategories.csv` añaden `icon`. Se actualizan las pruebas de `src/domain/csv.ts`.

## R9. Demo

**Decision**: `CATEGORIES`/`SUBCATEGORIES` del mock siguen derivando los ids del índice de `DEFAULT_TAXONOMY`; los ids cambian, pero nada externo los guarda (el demo no persiste). `seed.ts` reasigna sus perfiles de gasto a las nuevas subcategorías (p. ej. groceries → Groceries/Pantry, market → Groceries/Hygiene, fuel → Transport & Gas/Fuel, restaurants → Restaurants & Cafes/Restaurants, coffee → Restaurants & Cafes/Coffee, streaming → Streaming/Video streaming, gym → Gym & Wellness/Gym, rent → Housing/Rent, internetPhone → Telecom/Mobile plan, utilities → Home Services/Electricity). Ingresos: "Salary" → `salary`, "Freelance project" → `extra`. `tests/unit/data/mock-seed-consistency.test.ts` se ajusta. Los datos siguen siendo ficticios (constitución IV).

## R10. Pruebas

- **Unitarias (Vitest)**: invariantes de `DEFAULT_TAXONOMY` (26 categorías, 13/13 por bucket, nombres únicos, claves de ícono válidas, cada `nameKey` presente en EN y ES), `resolveTaxonomyIcon`, `incomeFormSchema` (tipo requerido), CSV, paridad i18n (existente), coherencia del seed.
- **pgTAP (Supabase local)**: columnas y `check` de `icon`; enum y default de `income_type`; RPCs guardan y reemplazan el tipo; `private.apply_taxonomy_004` sobre un usuario con la taxonomía de la nube: asigna claves e íconos, crea 1 Previous Balances, no duplica en una segunda llamada, no toca archivadas ni renombradas; `authenticated` no puede ejecutarla.
- **Contrato (mock y Supabase local)**: `icon` en crear/actualizar categoría y subcategoría; `incomeType` en registrar/reemplazar; ícono con formato inválido → `VALIDATION`.
- **E2E (Playwright)**: tipo de ingreso obligatorio y sugerencia de etiqueta; selector de ícono y herencia en el editor; 26 categorías en el demo; a11y en claro y oscuro (íconos `aria-hidden`).
- Requiere Docker y Supabase local (la memoria "UI-only: no local Supabase" no aplica: hay migración).
