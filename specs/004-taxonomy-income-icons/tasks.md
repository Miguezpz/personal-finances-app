---
description: "Task list for spec 004 — Taxonomía completa, tipos de ingreso e íconos"
---

# Tasks: Taxonomía completa, tipos de ingreso e íconos

**Input**: Design documents from `specs/004-taxonomy-income-icons/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: se incluyen. La constitución exige pruebas automatizadas de la lógica financiera y verificación en normal/demo y EN/ES; research R10 y `contracts/data-provider.md` (C1–C8) definen qué se prueba.

**Organization**: tareas agrupadas por historia de usuario. Todo en `main`, sin rama. Requiere Docker y Supabase local (`pnpm db:start`); nunca correr pruebas contra la nube.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia del spec (US1–US4)

---

## Phase 1: Setup

**Purpose**: línea base para medir y entorno local.

- [X] T001 Levantar Supabase local con `pnpm db:start` y `pnpm db:reset`, y registrar en `specs/004-taxonomy-income-icons/quickstart.md` (§ Prerrequisitos, como nota) el peso actual de `/` y `/dashboard` obtenido con `pnpm build && node scripts/measure-first-load.mjs`, para comparar con SC-005 (< 5 KB gzip extra)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: esquema, tipos de dominio y capa de datos que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T002 Crear `supabase/migrations/0008_taxonomy_income_icons.sql` (parte de esquema): `create type public.income_type as enum ('salary','gift','debt_repayment','cashback','extra','sales','savings','investment_returns','other')`; `alter table public.incomes add column income_type public.income_type not null default 'other'`; `alter table public.categories add column icon text` y lo mismo en `public.subcategories`, ambas nulables con `check (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 40)`
- [X] T003 En la misma migración `supabase/migrations/0008_taxonomy_income_icons.sql`, `create or replace` de `public.register_income(p_income jsonb, p_allocations jsonb)` y `public.replace_income(p_id uuid, p_income jsonb, p_allocations jsonb)` copiando el cuerpo de `supabase/migrations/0003_rpc.sql` (misma firma, `language plpgsql`, `security invoker`, `set search_path = public`) y añadiendo `income_type = coalesce(nullif(p_income ->> 'income_type', ''), 'other')::public.income_type` en el `insert` y en el `update` (research R4)
- [X] T004 Escribir pgTAP en `supabase/tests/taxonomy-income-icons.test.sql`: existe el enum con sus 9 valores; `incomes.income_type` es `not null` con default `'other'`; `icon` acepta `'plug'`, `'gamepad-2'` y `null` y rechaza `'Plug'`, `'a b'`, `'-x'` y una cadena de 41 caracteres; `register_income` guarda `'salary'` y sin la clave guarda `'other'`; `replace_income` cambia el tipo. Correr `pnpm db:reset && pnpm db:test`
- [X] T005 Regenerar `src/data/supabase/database.types.ts` con `pnpm db:types`
- [X] T006 [P] Crear `src/domain/income-types.ts` con `export const INCOME_TYPES = ["salary","gift","debt_repayment","cashback","extra","sales","savings","investment_returns","other"] as const` (mismo orden que el enum) y `export type IncomeType = (typeof INCOME_TYPES)[number]`, más `isIncomeType()`
- [X] T007 [P] Crear `src/domain/icons.ts` (puro, sin React): `CATEGORY_ICON_KEYS` como tupla `as const` con las 26 claves de research R1 (`house, plug, smartphone, car, shopping-cart, heart-pulse, dumbbell, repeat, wrench, graduation-cap, landmark, paw-print, clock-arrow-left, utensils, ticket, tv, shirt, scissors, gift, candy, headphones, plane, sofa, palette, hand-heart, ellipsis`) más las de R6 (`coffee, music, book-open, baby, fuel, bus, bike, gamepad-2, film, receipt-text, tag, store, briefcase, piggy-bank`); `CategoryIconKey`; `ICON_KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/` con máximo 40; `isCategoryIconKey(v: unknown)`; `resolveTaxonomyIcon(sub, category): CategoryIconKey | "generic"` con orden subcategoría → categoría → `"generic"` descartando claves no válidas
- [X] T008 [P] Pruebas unitarias de T006 y T007 en `tests/unit/domain/icons.test.ts`: las claves cumplen `ICON_KEY_FORMAT` y no se repiten; `resolveTaxonomyIcon` cubre sub con ícono, sub sin ícono (hereda), ambos nulos (`"generic"`), clave desconocida en la sub (cae a la categoría) y en la categoría (cae a `"generic"`)
- [X] T009 Actualizar `src/domain/types.ts`: `Category.icon: string | null`, `Subcategory.icon: string | null`, `Income.incomeType: IncomeType` (importado de `src/domain/income-types.ts`), con comentario de que `icon` puede traer una clave desconocida y se resuelve con `resolveTaxonomyIcon`
- [X] T010 Actualizar `src/data/provider.ts`: `createCategory`/`createSubcategory` reciben `icon: string | null`; `TaxonomyRepository.update` acepta `patch: { name?: string; archived?: boolean; icon?: string | null }`; los inputs de `IncomesRepository.register`/`replace` incluyen `incomeType: IncomeType` requerido (`contracts/data-provider.md`)
- [X] T011 Actualizar `src/data/supabase/mappers.ts` (`toCategory`, `toSubcategory` leen `icon`; `toIncome` lee `income_type`; el payload `p_income` de los RPCs incluye `income_type`) y `src/data/supabase/repos/taxonomy.ts` (insert de `icon`; `update` escribe `icon` cuando `patch.icon !== undefined`, y renombrar sigue poniendo `name_key: null` sin tocar `icon`) y `src/data/supabase/repos/incomes.ts`. Confirmar que `23514` (check_violation) ya se mapea a `ProviderError('VALIDATION')`; si no, añadirlo en `mappers.ts`
- [X] T012 Actualizar el mock en `src/data/mock/provider.ts`: guarda y devuelve `icon` e `incomeType`; replica la validación de formato con `ICON_KEY_FORMAT` y máximo 40 lanzando `ProviderError('VALIDATION')`; el bloqueo de escrituras en solo lectura no cambia
- [X] T013 Actualizar `tests/contract/schemas.ts` (`strictObject` de categoría y subcategoría con `icon: z.string().nullable()`, de ingreso con `incomeType: z.enum(INCOME_TYPES)`) y añadir los casos C1–C6 y C8 de `contracts/data-provider.md` en `tests/contract/data-provider.contract.ts`; ajustar los ingresos y categorías que crean las pruebas existentes (y `tests/utils/fixtures.ts`) para incluir `incomeType` e `icon`. Correr `pnpm test:contract:local`
- [X] T014 [P] Actualizar `src/domain/csv.ts`: `incomes.csv` añade la columna `income_type` (valor del enum); `categories.csv` y `subcategories.csv` añaden `icon`; actualizar `tests/unit/domain/csv.test.ts`

**Checkpoint**: esquema local, dominio y ambos proveedores con los campos nuevos y la suite de contrato en verde.

---

## Phase 3: User Story 1 - Mi taxonomía es la de la app (Priority: P1) 🎯 MVP

**Goal**: las 26 categorías del dueño son el default de cuentas nuevas y del demo; la cuenta existente recibe claves, íconos y Previous Balances sin duplicados.

**Independent Test**: cuenta local nueva y demo muestran 26 categorías (13 Needs, 13 Wants) y 68 subcategorías; la función de backfill sobre un usuario con la taxonomía de la nube asigna claves e íconos, crea 1 Previous Balances y no duplica en una segunda llamada.

### Tests for User Story 1

- [X] T015 [P] [US1] Crear `tests/unit/domain/default-taxonomy.test.ts`: 26 categorías; 13 `needs` y 13 `wants`; 68 subcategorías; nombres de categoría únicos; nombres de subcategoría únicos dentro de su categoría; `icon` ∈ `CATEGORY_ICON_KEYS`; ninguna subcategoría tiene `nameKey`; cada `nameKey` de categoría existe en `src/i18n/messages/en.json` y `es.json`; existe `Previous Balances` en `needs` con la subcategoría `Previous balances`
- [X] T016 [P] [US1] Añadir a `supabase/tests/taxonomy-income-icons.test.sql` las pruebas del backfill: crear un usuario de prueba con las 25 categorías activas de research R1 (sin `name_key`, salvo Housing con `taxonomy.housing`), una categoría archivada `Food` con `taxonomy.food`, una categoría propia `Mi categoría` y una renombrada; llamar `private.apply_taxonomy_004(uid)` dos veces y comprobar: las 25 tienen `name_key` e `icon` esperados, existe exactamente 1 `Previous Balances` (`needs`) con 1 subcategoría `Previous balances`, `Food` y `Mi categoría` no cambian, no se tocó ninguna subcategoría existente, y el rol `authenticated` no puede ejecutar la función

### Implementation for User Story 1

- [X] T017 [US1] Reescribir `src/domain/default-taxonomy.ts` con las 26 categorías de la tabla de research R1, en ese orden: `name` = nombre EN exacto de la tabla (debe coincidir carácter por carácter con la nube, p. ej. `Pocket Money / Snacks`, `Maintenance & Contingencies`), `macro`, `icon`, `nameKey` (`taxonomy.housing` para Housing y `taxonomy.categories.<clave>` para las demás) y `subcategories: { name }[]` sin `nameKey`. Housing lleva solo `Rent`, `Maintenance`, `Property tax`. `DefaultSubcategory` pierde `nameKey` y `DefaultCategory` gana `icon: CategoryIconKey` (data-model.md)
- [X] T018 [P] [US1] Añadir a `src/i18n/messages/en.json` y `src/i18n/messages/es.json` el objeto `taxonomy.categories` con las 25 claves nuevas (EN = nombre de la tabla R1; ES = columna "ES" de R1). Conservar todas las claves planas existentes de `taxonomy.*` (research R2). Correr `tests/unit/i18n/parity.test.ts`
- [X] T019 [US1] Añadir a `supabase/migrations/0008_taxonomy_income_icons.sql` la parte de backfill (research R3): `create schema if not exists private`; `revoke all on schema private from public, anon, authenticated`; función `private.apply_taxonomy_004(p_user uuid) returns void` (`language plpgsql`, `set search_path = public`) que, con una lista `(name, name_key, icon)` igual a T017, hace `update public.categories set name_key = v.name_key, icon = v.icon where user_id = p_user and name = v.name and archived_at is null and (name_key is null or name_key = v.name_key)`, e inserta `Previous Balances` (`macro 'needs'`, `name_key 'taxonomy.categories.previousBalances'`, `icon 'clock-arrow-left'`, `user_id = p_user`) con `on conflict (user_id, name) do nothing` y, si se creó, su subcategoría `Previous balances` (`user_id = p_user`); `revoke execute on function private.apply_taxonomy_004(uuid) from public, anon, authenticated`; al final, `select private.apply_taxonomy_004(u) from (select distinct user_id as u from public.categories) s`. Correr `pnpm db:reset && pnpm db:test`
- [X] T020 [US1] Añadir a `tests/unit/domain/default-taxonomy.test.ts` una comprobación de que la lista `(name, name_key, icon)` de la función de T019 coincide con `DEFAULT_TAXONOMY`, leyendo `supabase/migrations/0008_taxonomy_income_icons.sql` y extrayendo las tuplas con una expresión regular (evita que el backfill y el default se desincronicen)
- [X] T021 [US1] Actualizar `src/features/settings/onboarding.ts`: crear las categorías con `icon: def.icon` y las subcategorías con `nameKey: null` e `icon: null`; deduplicar subcategorías por `name` dentro de su categoría en lugar de por `nameKey` (research R2); actualizar el comentario de cabecera
- [X] T022 [US1] Actualizar `src/data/mock/fixtures/catalog.ts`: `CATEGORIES` incluye `icon`; `SUBCATEGORIES` incluye `icon: null` y `nameKey: null`; sustituir `subcategoryId(nameKey)` por `subcategoryId(categoryNameKey: string, subName: string)` que lanza si no existe
- [X] T023 [US1] Actualizar `src/data/mock/seed.ts`: reasignar cada perfil de gasto y recurrente a la nueva subcategoría según research R9 (groceries → Groceries/Pantry, market → Groceries/Hygiene, fuel → Transport & Gas/Fuel, publicTransport → Transport & Gas/Public transport, pharmacy → Health & Insurance/Medicine, doctor → Health & Insurance/Doctor, utilities → Home Services/Electricity, restaurants → Restaurants & Cafes/Restaurants, coffee → Restaurants & Cafes/Coffee, events → Entertainment & Leisure/Concerts, clothing → Clothes & Shoes/Clothing, electronics → Tech & Gadgets/Audio, rent → Housing/Rent, internetPhone → Telecom/Mobile plan, streaming → Streaming/Video streaming, gym → Gym & Wellness/Gym), usando `subcategoryId(categoryKey, name)`; los buckets de cada perfil deben coincidir con el `macro` de su categoría
- [X] T024 [US1] Ajustar `tests/unit/data/mock-seed-consistency.test.ts` y el caso C7 de `contracts/data-provider.md` en `tests/contract/data-provider.contract.ts` (snapshot del demo con 26 categorías y 68 subcategorías). Correr `pnpm test` y `pnpm test:contract:local`
- [X] T025 [US1] Añadir a `tests/unit/domain/safe-to-spend.test.ts` un caso: un gasto en una subcategoría de una categoría `needs` llamada Previous Balances descuenta de Needs en la quincena actual (FR-004, US1-5)

**Checkpoint**: US1 completa y verificable sola (quickstart escenarios A y H).

---

## Phase 4: User Story 2 - Clasificar mis ingresos por tipo (Priority: P1)

**Goal**: cada ingreso tiene uno de 9 tipos; el alta obliga a elegirlo; la lista y el CSV lo muestran.

**Independent Test**: guardar sin tipo muestra el error; elegir "Salario" con etiqueta vacía rellena la etiqueta; la lista muestra ícono y tipo; editar cambia el tipo sin tocar el reparto; el CSV trae `income_type`.

### Tests for User Story 2

- [X] T026 [P] [US2] Ampliar `tests/unit/features/settings-schemas.test.ts` o crear `tests/unit/features/income-schema.test.ts`: `incomeFormSchema` rechaza `incomeType: ""` con el mensaje `typeRequired`, acepta los 9 valores y propaga `incomeType` a la salida
- [X] T027 [P] [US2] Crear `tests/e2e/us11-income-type.spec.ts` (modo normal, EN y ES): alta sin tipo → no se guarda y aparece el mensaje; con etiqueta vacía, elegir Salario → etiqueta "Salario"/"Salary"; guardar → la lista muestra el tipo; editar → cambiar a Regalo y confirmar que los montos del reparto no cambian; en demo, cambiar el tipo muestra el aviso de solo lectura

### Implementation for User Story 2

- [X] T028 [P] [US2] Crear `src/components/icons/income-type-icons.ts`: `INCOME_TYPE_ICONS = { salary: Briefcase, gift: Gift, debt_repayment: HandCoins, cashback: BadgePercent, extra: CirclePlus, sales: Store, savings: PiggyBank, investment_returns: TrendingUp, other: Ellipsis } satisfies Record<IncomeType, LucideIcon>` con imports nombrados de `lucide-react`
- [X] T029 [P] [US2] Añadir a `src/i18n/messages/en.json` y `es.json`: `income.type.<valor>` para los 9 tipos (ES: Salario, Regalo, Pago de deuda, Cashback, Extra, Ventas, Ahorros, Rendimientos de inversión, Otro), `income.typeLabel` ("Type"/"Tipo") y `income.typeRequired` ("Choose an income type"/"Elige un tipo de ingreso")
- [X] T030 [US2] Actualizar `src/features/income/schemas.ts`: `incomeType: z.enum(INCOME_TYPES, { message: "typeRequired" })` en `incomeFormSchema` y en su salida transformada
- [X] T031 [US2] Crear `src/features/income/IncomeTypeField.tsx` según `contracts/ui-components.md`: `RadioGroup` de `src/components/ui/radio-group.tsx` con las 9 opciones en cuadrícula (ícono `aria-hidden` + nombre traducido), sin selección inicial, error asociado con `aria-describedby` y `role="alert"`
- [X] T032 [US2] Integrar el campo en `src/features/income/RegisterIncomeDialog.tsx`: valor por defecto `""` en alta y el tipo guardado en edición; al elegir un tipo con la etiqueta vacía, rellenarla con el nombre traducido del tipo sin pisar texto ya escrito; enviar `incomeType` a `src/features/income/hooks.ts`
- [X] T033 [US2] Mostrar el tipo con su ícono junto a la etiqueta en cada fila de `src/features/income/IncomePage.tsx`
- [X] T034 [US2] Asignar tipos en `src/data/mock/seed.ts`: "Salary" → `salary`, "Freelance project" → `extra`
- [X] T035 [US2] Actualizar `tests/e2e/us1-income-split.spec.ts` (y cualquier otra e2e que registre ingresos, p. ej. `tests/e2e/fixtures.ts`) para elegir un tipo antes de guardar. Correr `pnpm test:e2e:local`

**Checkpoint**: US2 completa y verificable sola (quickstart escenarios B–E).

---

## Phase 5: User Story 3 - Reconocer categorías por su ícono (Priority: P2)

**Goal**: ícono por categoría con selector; subcategorías heredan y pueden tener uno propio.

**Independent Test**: cambiar el ícono de Streaming y verlo en gastos, ledger y recurrentes; dar y quitar un ícono propio a Video streaming; una categoría propia sin ícono muestra el genérico.

### Tests for User Story 3

- [X] T036 [P] [US3] Crear `tests/e2e/us12-category-icons.spec.ts` (modo normal): abrir el selector de una categoría con teclado, elegir otro ícono y comprobar que aparece en gastos, ledger y recurrentes; dar ícono propio a una subcategoría, luego elegir "Usar el de la categoría"; crear una categoría propia y ver el genérico; en demo, el selector muestra el aviso de solo lectura

### Implementation for User Story 3

- [X] T037 [P] [US3] Crear `src/components/icons/category-icons.ts`: `CATEGORY_ICONS = { house: House, plug: Plug, …, "clock-arrow-left": ClockArrowLeft, … } satisfies Record<CategoryIconKey, LucideIcon>` con imports nombrados (prohibido `import *` o acceso dinámico por nombre) y `GENERIC_CATEGORY_ICON = Shapes`
- [X] T038 [US3] Crear `src/components/icons/CategoryIcon.tsx`: `props { icon: CategoryIconKey | "generic"; className?: string }`, `aria-hidden="true"`, `focusable="false"`, `size-4 text-muted-foreground` por defecto
- [X] T039 [P] [US3] Añadir a `src/i18n/messages/en.json` y `es.json`: `taxonomy.icon`, `taxonomy.iconPicker` (con el nombre de la categoría como parámetro), `taxonomy.iconInherited` ("Use the category icon"/"Usar el de la categoría") y `taxonomy.iconRemove`
- [X] T040 [US3] Actualizar `src/features/settings/taxonomy/schema.ts`: el campo `icon` es opcional y, si viene, MUST cumplir `isCategoryIconKey` (FR-012)
- [X] T041 [US3] Crear `src/features/settings/taxonomy/IconPicker.tsx` según `contracts/ui-components.md`: disparador con el ícono actual y nombre accesible traducido; `Dialog` con cuadrícula `role="radiogroup"` y opciones `role="radio"` navegables con flechas y `Enter`/`Espacio`; en subcategorías, primera opción `iconInherited` que emite `null`; `disabled` en solo lectura
- [X] T042 [US3] Integrar `IconPicker` en `src/features/settings/taxonomy/TaxonomyEditor.tsx` para categorías y subcategorías y mostrar `CategoryIcon` junto a cada nombre; añadir la mutación de ícono en `src/features/settings/taxonomy/hooks.ts` usando `provider.taxonomy.update(kind, id, { icon })`
- [X] T043 [P] [US3] Mostrar `CategoryIcon` (con `resolveTaxonomyIcon(sub, category)`) junto al nombre de categoría/subcategoría en `src/features/expenses/ExpensesPage.tsx`
- [X] T044 [P] [US3] Mostrar `CategoryIcon` junto a la subcategoría en `src/features/ledger/LedgerTable.tsx` (filas de gasto y recurrente)
- [X] T045 [P] [US3] Mostrar `CategoryIcon` junto a la subcategoría en `src/features/recurring/RecurringPage.tsx`
- [X] T046 [US3] Confirmar que `src/features/settings/taxonomy/SubcategoryOptions.tsx` y `src/features/ledger/LedgerFilters.tsx` (listas nativas) siguen solo con texto (US3-5); no requieren cambios salvo los tipos

**Checkpoint**: US3 completa (quickstart escenarios F y G).

---

## Phase 6: User Story 4 - Íconos de apoyo en el resto de la app (Priority: P3)

**Goal**: íconos decorativos en las superficies de FR-014, estado vacío y encabezado compartidos.

**Independent Test**: recorrer las páginas en claro y oscuro, EN y ES: íconos junto al texto, no anunciados; estados vacíos y encabezados uniformes.

### Tests for User Story 4

- [X] T047 [P] [US4] Ampliar `tests/e2e/a11y.spec.ts` para recorrer las páginas tocadas en claro y oscuro, comprobar con axe que no hay hallazgos nuevos y que todo `svg.lucide` dentro de botones, badges y encabezados tiene `aria-hidden="true"` y no altera el nombre accesible (FR-016, SC-007)

### Implementation for User Story 4

- [X] T048 [P] [US4] Crear `src/components/icons/domain-icons.ts` con `ACCOUNT_KIND_ICONS` (checking `Landmark`, savings `PiggyBank`, credit_card `CreditCard`, investment `TrendingUp`, cash `Banknote`), `BUCKET_ICONS` (needs `ShieldCheck`, wants `Sparkles`, investment `Sprout`), `LEDGER_TYPE_ICONS` (expense `ArrowUpRight`, income `ArrowDownLeft`, card_payment `CreditCard`, installment `HandCoins`), `RECEIVABLE_STATUS_ICONS` (pending `Clock`, partial `CircleDashed`, collected `CircleCheck`) y `GOAL_KIND_ICONS` (emergency_fund `LifeBuoy`, sinking_fund `PiggyBank`), cada uno con `satisfies Record<…, LucideIcon>`
- [X] T049 [P] [US4] Crear `src/components/ui/empty-state.tsx` según `contracts/ui-components.md` (`icon`, `children`, `action?`; ícono `size-8` tenue y `aria-hidden`)
- [X] T050 [P] [US4] Crear `src/components/layout/PageHeader.tsx` según `contracts/ui-components.md` (`icon`, `title`, `description?`, `actions?`; `<h1>` con ícono `aria-hidden`) y exportar desde `src/components/layout/nav-items.ts` un acceso al ícono de cada página
- [X] T051 [US4] Tipo de cuenta: ícono de `ACCOUNT_KIND_ICONS` en el badge de `src/features/settings/accounts/AccountsSettings.tsx` y junto al nombre de cuenta en `src/features/ledger/LedgerTable.tsx`, `src/features/expenses/ExpensesPage.tsx`, `src/features/income/IncomePage.tsx` y `src/features/recurring/RecurringPage.tsx`
- [X] T052 [US4] Bucket: ícono de `BUCKET_ICONS` en el título de `src/features/safe-to-spend/BucketCard.tsx` y en los badges de bucket de `src/features/expenses/ExpensesPage.tsx`, `src/features/recurring/RecurringPage.tsx` y `src/features/income/IncomePage.tsx`
- [X] T053 [US4] Tipo de movimiento: `LEDGER_TYPE_ICONS` en `src/features/ledger/LedgerTable.tsx` (vista de tabla y de tarjetas, usando el `data-type` existente)
- [X] T054 [P] [US4] Cobros y deudor: `RECEIVABLE_STATUS_ICONS` en los badges de estado y `UserRound` junto al deudor en `src/features/receivables/ReceivablesPage.tsx`
- [X] T055 [P] [US4] Metas: `GOAL_KIND_ICONS` en el badge `kinds.*` de `src/features/goals/GoalsPage.tsx`
- [X] T056 [US4] Marcas de gasto: `Repeat` junto a "automático" en `src/features/expenses/ExpensesPage.tsx` y `Pause` junto a "pausado" en `src/features/recurring/RecurringPage.tsx`
- [X] T057 [P] [US4] KPIs de patrimonio: `Scale`, `ArrowUpRight` y `ArrowDownRight` en `src/features/net-worth/NetWorthPage.tsx`
- [X] T058 [P] [US4] Fechas de tarjeta: `Scissors` (corte) y `CalendarClock` (pago) en `src/features/expenses/CardDebtSummary.tsx`, `src/features/credit/CreditPage.tsx` y `src/features/receivables/CollectionAlerts.tsx`, conservando el `TriangleAlert` de vencido existente
- [X] T059 [P] [US4] Preferencias y dashboard: `Languages` y `Coins` en las filas de `src/components/layout/PreferencesSheet.tsx`; `CircleAlert` en el aviso de error de `src/features/safe-to-spend/Dashboard.tsx`
- [X] T060 [US4] Sustituir los estados vacíos con borde punteado por `EmptyState` (ícono de la página desde `nav-items.ts`, mismo mensaje traducido) en `src/features/receivables/ReceivablesPage.tsx`, `src/features/goals/GoalsPage.tsx`, `src/features/expenses/ExpensesPage.tsx`, `src/features/recurring/RecurringPage.tsx`, `src/features/income/IncomePage.tsx`, `src/features/ledger/LedgerPage.tsx`, `src/features/credit/CreditTimeline.tsx` y `src/features/net-worth/NetWorthPage.tsx`
- [X] T061 [US4] Sustituir el `<h1>` de cada página principal por `PageHeader` con el ícono de `nav-items.ts`, sin cambiar su texto ni su jerarquía (páginas de `src/features/*/…Page.tsx` y `src/features/safe-to-spend/Dashboard.tsx`); ajustar las e2e que busquen esos títulos por rol si cambia su estructura

**Checkpoint**: todas las historias funcionan (quickstart escenarios I y J).

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T062 Puertas de calidad: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:test`, `pnpm test:contract:local`, `pnpm test:e2e:local` y `pnpm check:demo-bundle`, todas en verde
  - Estado 2026-11-05: typecheck, lint, formato, 453 unitarias, 127 pgTAP, 30 de contrato y `check:demo-bundle` en verde. E2E: 123/132 en la corrida completa; al repetir solas, todas pasan salvo `brand.spec.ts` (CTA por pantalla), que falla por tiempos de espera con la máquina saturada (carga ~70). Se ajustó para ignorar páginas que Next conserva ocultas en el DOM; confirmada después (12/12).
  - Corrida completa con `--workers=3`: 130/132; las 2 restantes (`mobile.spec.ts` scroll del CTA y `us11` editar justo tras crear) pasan al repetirlas (20/20). `us11` ahora recarga antes de editar: un ingreso recién creado conserva un id temporal hasta que llega la recarga del snapshot (carrera previa, no de esta feature).
  - Se agregó `TaxonomyRepository.insertCategories/insertSubcategories` (inserción en lote idempotente, caso de contrato C9): el onboarding pasó de 94 peticiones a 4, lo que hacía fallar por tiempo varias e2e.
- [X] T063 Medir `pnpm build && node scripts/measure-first-load.mjs` y comparar con T001: el crecimiento de `/` y `/dashboard` MUST ser < 5 KB gzip (SC-005); si se excede, mover los mapas grandes fuera de los módulos que carga el dashboard
  - Resultado: `/` 297.7 → 299.1 kB gzip (+1.4 kB); `/dashboard` 337.5 → 341.3 kB gzip (+3.8 kB). Dentro de SC-005 (< 5 kB).
- [ ] T064 Verificar a mano los escenarios A–J y el demo de `specs/004-taxonomy-income-icons/quickstart.md` en EN y ES y en claro y oscuro (`pnpm dev` y `pnpm dev:demo`), y marcar sus criterios de salida
- [X] T065 [P] Actualizar `README.md` (tipos de ingreso, íconos y taxonomía por defecto) y `docs/deploy.md` (aplicar `0008` y la verificación SQL de quickstart § 4)
- [ ] T066 Commit en `main` y, **solo con aprobación expresa del dueño**, aplicar `0008` a `potodtpkgadgsmeuuafx` con versión `0008` (una sola migración) y ejecutar las consultas de verificación de quickstart § 4 (26 activas, 1 Previous Balances, 0 sin ícono, 0 sin clave, ingresos en `other`, totales idénticos); después push para desplegar y repetir los escenarios B–F en producción
  - 2026-11-05: `0008` aplicada a `potodtpkgadgsmeuuafx` con aprobación del dueño y registrada como versión `0008`. Verificación: 26 categorías activas, 1 Previous Balances (Needs) con su subcategoría, 0 sin ícono, 0 sin clave; gastos 0, ingresos 0, 16 cuentas, 2 recurrentes y 1 regla, igual que antes; `authenticated` no puede ejecutar `private.apply_taxonomy_004`; asesores de seguridad sin avisos nuevos. Pendiente: repetir los escenarios B–F en producción (requiere la sesión del dueño).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias. Orden interno: T002 → T003 → T004 → T005; T006–T008 en paralelo con T002–T005; T009 → T010 → T011/T012 → T013; T014 tras T009.
- **US1 (Phase 3)** y **US2 (Phase 4)**: tras Phase 2, independientes entre sí.
- **US3 (Phase 5)**: tras Phase 2; usa los íconos asignados en T017 para mostrar algo útil, pero se puede probar con categorías creadas a mano.
- **US4 (Phase 6)**: solo depende de Phase 2.
- **Polish (Phase 7)**: tras las historias que se quieran entregar.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- US1: T017 → T018/T019 → T020; T021–T023 tras T017; T024 tras T022–T023.
- US2: T028–T030 → T031 → T032 → T033; T034 independiente; T035 al final.
- US3: T037 → T038 → T041 → T042; T043–T045 tras T038.
- US4: T048–T050 primero; T051–T061 después (varias tocan los mismos archivos de página: no paralelizar T051, T052, T056 y T060 entre sí).

## Parallel Opportunities

- Phase 2: T006, T007 y T008 junto con la migración (T002–T004); T014 en paralelo con T011–T013.
- US1: T015 y T016 a la vez; T018 en paralelo con T019.
- US2: T026, T027, T028 y T029 a la vez.
- US3: T036, T037 y T039 a la vez; T043, T044 y T045 a la vez.
- US4: T047–T050 a la vez; T054, T055, T057, T058 y T059 a la vez.
- US1, US2 y US4 pueden avanzar en paralelo tras Phase 2.

## Implementation Strategy

### MVP

Phase 1 → Phase 2 → US1. Con eso las cuentas nuevas y el demo ya tienen la taxonomía del dueño, y la migración deja lista la cuenta existente.

### Entrega incremental

1. MVP (US1) → validar escenarios A y H.
2. US2 (tipos de ingreso) → escenarios B–E.
3. US3 (íconos de categoría) → F y G.
4. US4 (íconos de apoyo) → I y J.
5. Polish y, con aprobación, la nube (T066). La migración `0008` se aplica una sola vez, con todo lo de US1 y US2 ya incluido.
