---

description: "Task list for Personal Finances Core"
---

# Tasks: Personal Finances Core

**Input**: Design documents from `/specs/001-personal-finances-core/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (todos presentes)

**Tests**: INCLUIDAS. La constitución exige que la lógica financiera tenga pruebas automatizadas antes de darse por completa (Flujo de Desarrollo y Calidad) y el plan define Vitest, pruebas de contrato, pgTAP y Playwright. Las pruebas de cada historia se escriben primero y DEBEN fallar antes de implementar.

**Organization**: Setup (scaffolding) → Foundational (tipos, base de datos, persistencia Supabase/Mock, infraestructura de UI) → una fase por historia de usuario (lógica de negocio → hooks → vistas UI) → Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: historia de usuario del spec (US1…US10)
- Todas las rutas son relativas a la raíz del repositorio `personal-finances-app/`
- En las tareas e2e, "proyecto `demo`" o "proyecto `live`" significa ambos proyectos de ese modo (`-en` y `-es`), según la matriz modo × idioma de plan.md
- Los IDs T158–T167 se añadieron tras `/speckit-analyze`; están ubicados en su fase lógica y no siguen el orden numérico

## Path Conventions

Proyecto único Next.js (App Router), según plan.md: `src/app`, `src/domain`, `src/data`, `src/features`, `src/store`, `src/i18n`, `src/components`, `src/lib`, `supabase/`, `tests/`.

---

## Phase 1: Setup (Scaffolding inicial)

**Purpose**: inicializar el proyecto, herramientas y configuración base

- [X] T001 Inicializar Next.js (App Router, TypeScript, `src/` dir, pnpm) en la raíz del repo sin sobrescribir `.claude/`, `.specify/` ni `specs/`; crear `package.json`, `next.config.ts`, `src/app/layout.tsx` y `src/app/page.tsx` mínimos
- [X] T002 Configurar `tsconfig.json` con `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true` y alias `@/*` → `src/*`; añadir scripts `typecheck`, `lint`, `test`, `test:contract`, `test:e2e` en `package.json`
- [X] T003 Instalar dependencias de runtime en `package.json`: `@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query`, `zustand`, `next-intl`, `zod`, `react-hook-form`, `@hookform/resolvers`, `framer-motion`, `lucide-react`, `recharts`, `sonner`; y de desarrollo: `vitest`, `@testing-library/react`, `jsdom`, `fast-check`, `@playwright/test`
- [X] T004 [P] Configurar ESLint en `eslint.config.mjs`: `@typescript-eslint/no-explicit-any` en error, `@typescript-eslint/ban-ts-comment` exigiendo descripción, `no-restricted-imports` que prohíba `@supabase/*` fuera de `src/data/supabase/**`, regla contra `Intl.NumberFormat` con `style: "currency"` fuera de `src/i18n/format.ts`, `no-restricted-syntax` que prohíba `<input type="file">` (FR-044) y `no-restricted-properties` que prohíba leer `provider.mode` y `env.isDemo` fuera de `src/data/index.ts`, `src/lib/env.ts`, `src/middleware.ts`, `src/app/page.tsx` y `src/components/layout/DemoBanner.tsx` (la UI y los hooks preguntan por `capabilities`, Principio IV) y `no-console` en `src/` (Principio V: sin logging que pueda contener montos)
- [X] T005 [P] Configurar Prettier en `.prettierrc` y `.prettierignore`
- [X] T006 [P] Inicializar Tailwind CSS y shadcn/ui (`components.json`, `src/app/globals.css`, `src/lib/utils.ts`) y añadir componentes base en `src/components/ui/` (button, input, label, select, dialog, sheet, card, tabs, badge, table, skeleton, switch, dropdown-menu, form, calendar, sonner) — nota: `form` está deprecado en el registro actual de shadcn (estilo radix-nova); se instaló su reemplazo `field` (+ `separator`), usado con `Controller` de react-hook-form
- [X] T007 [P] Configurar Vitest en `vitest.config.ts` (entorno jsdom, alias `@`) y `tests/setup.ts` con matchers de Testing Library
- [X] T008 [P] Configurar Playwright en `playwright.config.ts` con cuatro proyectos (matriz modo × idioma): `demo-en` y `demo-es` (`NEXT_PUBLIC_DEMO_MODE=true`), `live-en` y `live-es` (Supabase local), fijando el idioma con la cookie `NEXT_LOCALE`
- [X] T009 [P] Crear `.env.example` con `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_DEMO_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sin valores reales) y verificar que `.gitignore` ignora `.env*` excepto `.env.example`
- [X] T010 [P] Crear `src/lib/env.ts` que valide las variables con Zod y exponga `env.isDemo`; exigir las variables de Supabase solo cuando `isDemo` es false
- [X] T011 Inicializar Supabase CLI en `supabase/config.toml` con `enable_signup = false` en `[auth]`
- [X] T012 [P] Crear `.github/workflows/ci.yml` con jobs: typecheck, lint, vitest, pgTAP (`supabase start` + `supabase test db`), contrato, `check:demo-bundle`, `check:no-uploads` y e2e con los cuatro proyectos de Playwright (el fallo de cualquiera falla el CI)

---

## Phase 2: Foundational (Tipos, base de datos, persistencia Supabase/Mock e infraestructura UI)

**Purpose**: todo lo que bloquea a las historias de usuario

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase

### Modelos y tipos del dominio

- [X] T013 [P] Copiar `specs/001-personal-finances-core/contracts/domain-types.ts` a `src/domain/types.ts` sin cambiar los nombres exportados
- [X] T014 [P] Crear `src/domain/errors.ts` con `InvalidWeightsError`, `RuleNotConfiguredError` e `InvalidMoneyError` (firmas de `contracts/domain-engine.ts`)
- [X] T015 [P] Escribir prueba que falle en `tests/unit/domain/money.test.ts`: con fast-check, para cualquier `total ≥ 0` y pesos en bps que sumen 10000, `Σ allocateByWeights(total, pesos) === total`, cada resultado ≥ 0 y el residuo va a la entrada de mayor peso (empate: la primera); `InvalidWeightsError` si Σ pesos ≠ 10000
- [X] T016 Implementar `src/domain/money.ts` con helpers `cents()`, `bps()`, suma/resta de `Cents` y `allocateByWeights` por mayor residuo (solo enteros, sin floats) para pasar T015
- [X] T017 [P] Escribir prueba que falle en `tests/unit/domain/periods.test.ts`: `periodOf` (1–15 → `YYYY-MM-1`, 16–fin → `YYYY-MM-2`), `nextPeriod`/`previousPeriod` entre meses y años, `clampChargeDay` (31 en febrero → 28/29, 31 en abril → 30) y `todayIn(timezone, now)` en `America/Mexico_City` cerca de medianoche UTC
- [X] T018 Implementar `src/domain/periods.ts` con `periodOf`, `periodFromKey`, `nextPeriod`, `previousPeriod`, `clampChargeDay`, `todayIn` (sin `Date.now()` implícito) para pasar T017

### Base de datos Supabase (migraciones y RLS)

- [X] T019 Crear `supabase/migrations/0001_schema.sql` con enums, `set_updated_at()` y las 17 tablas de `contracts/db-schema.sql` conservando literalmente sus `CHECK`: nombres 1–60 (cuentas, categorías, subcategorías), `amount_cents > 0`, `note` ≤ 200, `term_months` 1–48, `charge_day` 1–31, `*_bps` 0–10000, `cut_off_day` obligatorio si `kind = credit_card`
- [X] T020 Crear `supabase/migrations/0002_invariants.sql` con las funciones verificadoras `check_income_allocations` y `check_receivable_installments`, los triggers diferidos de ambos lados (`trg_allocations_sum` + `trg_income_total`, `trg_installments_sum` + `trg_receivable_total`) y `assert_subrules_sum` y los índices únicos de idempotencia (`expenses_recurring_occurrence_uq`, `goal_contributions(goal_id, period_start)`)
- [X] T021 Crear `supabase/migrations/0003_rpc.sql` con `register_income`, `create_receivable` y `save_distribution_rule` como `SECURITY INVOKER` con `search_path = public`; `save_distribution_rule` rechaza con `23505` (→ `CONFLICT`) reemplazar una regla cuya vigencia ya tiene ingresos asociados
- [X] T022 Crear `supabase/migrations/0004_ledger_view.sql` con la vista `ledger_entries` (`security_invoker = true`)
- [X] T023 Crear `supabase/migrations/0005_rls.sql`: `ENABLE` y `FORCE ROW LEVEL SECURITY` en las 17 tablas, política `<tabla>_owner` con `(select auth.uid())`, `REVOKE ALL FROM anon`, `GRANT` a `authenticated` y permisos de ejecución de las RPC
- [X] T024 [P] Escribir pgTAP en `supabase/tests/rls.test.sql`: un segundo usuario no puede leer, insertar, actualizar ni referenciar filas del primero (incluida una FK cruzada), y `anon` no tiene acceso a ninguna tabla ni a la vista
- [X] T025 [P] Escribir pgTAP en `supabase/tests/invariants.test.sql`: asignaciones ≠ monto del ingreso falla al COMMIT, un ingreso con `distributed = true` sin asignaciones falla, un `UPDATE` del monto del ingreso sin recalcular asignaciones falla, mensualidades ≠ total falla, una compra a terceros sin mensualidades o con número ≠ `term_months` falla, sub-reglas ≠ 10000 con `investment_bps > 0` falla, `save_distribution_rule` falla si la vigencia ya tiene ingresos asociados, y la segunda inserción de la misma `(recurring_expense_id, occurrence_date)` es rechazada

### Contrato de persistencia y proveedor Supabase

- [X] T026 [P] Copiar `contracts/data-provider.ts` a `src/data/provider.ts` (interfaz `DataProvider`, repositorios, `ProviderError`, `DemoReadOnlyError`) y crear `src/data/errors.ts` re-exportando los errores
- [X] T027 [P] Crear `src/data/query-keys.ts` con las claves de consulta: `snapshot` como única clave de datos de dominio, más `fx` y `session`
- [X] T028 Generar `src/data/supabase/database.types.ts` con `supabase gen types typescript --local` y crear `src/data/supabase/client.ts` con `createBrowserClient` (único archivo que importa `@supabase/ssr`)
- [X] T029 Crear `src/data/supabase/mappers.ts` con conversiones fila ⇄ tipo de dominio (centavos como `Cents`, `date` como `IsoDate`, bps como `BasisPoints`) y un mapeo de errores de Postgres a `ProviderError` (`23514` → `VALIDATION`, `23505` → `CONFLICT`, timeouts/503 → `COLD_START`, sin red → `OFFLINE`)
- [X] T030 [P] Implementar `src/data/supabase/repos/settings.ts` y `src/data/supabase/repos/accounts.ts` (`archive` rechaza con `CONFLICT` si hay MSI pendientes en la tarjeta)
- [X] T031 [P] Implementar `src/data/supabase/repos/rules.ts` (lista reglas con sub-reglas; `save` invoca la RPC `save_distribution_rule`)
- [X] T032 [P] Implementar `src/data/supabase/repos/taxonomy.ts` (categorías y subcategorías; `remove` rechaza con `CONFLICT` si hay movimientos)
- [X] T033 [P] Implementar `src/data/supabase/repos/incomes.ts` (`list`, `register` vía RPC `register_income`, `replace`, `remove`)
- [X] T034 [P] Implementar `src/data/supabase/repos/expenses.ts` (CRUD y `materializeRecurring` con `upsert(..., { onConflict: 'recurring_expense_id,occurrence_date', ignoreDuplicates: true })` devolviendo solo filas insertadas) y `src/data/supabase/repos/recurring.ts`
- [X] T035 [P] Implementar `src/data/supabase/repos/card-payments.ts` y `src/data/supabase/repos/receivables.ts` (`create` vía RPC `create_receivable`, `recordCollection` deriva `status` de `collected_cents`)
- [X] T036 [P] Implementar `src/data/supabase/repos/goals.ts` (contribuciones idempotentes), `src/data/supabase/repos/net-worth.ts` (`upsertMonthly` idempotente por mes) y `src/data/supabase/repos/ledger.ts` (lee la vista)
- [X] T037 Implementar `src/data/supabase/auth.ts` (email + contraseña, `getSession`, `signIn`, `signOut`, `onChange`) y ensamblar `src/data/supabase/provider.ts` con todos los repositorios `mode: 'live'`, `capabilities: { canWrite: true }` y `loadSnapshot()` en una sola carga

### Proveedor Mock (demo)

- [X] T038 [P] Crear `src/data/mock/store.ts` (almacén en memoria tipado como `FinanceSnapshot`) y `src/data/mock/read-only.ts` con un helper `denyWrite(name)` que lanza `DemoReadOnlyError`
- [X] T039 [P] Crear fixtures en `src/data/mock/fixtures/catalog.ts` (cuentas: débito, 2 tarjetas con corte y límite de pago, Bolsa y Sofipos; categorías y subcategorías Needs/Wants; regla 50/30/20 con sub-reglas 90/10) y `src/data/mock/fixtures/people.ts` (deudores ficticios)
- [X] T040 Crear `src/data/mock/seed.ts`: generador determinista que además exporta `generateHistory(years)` (mismo generador con volumen configurable, usado por las pruebas de rendimiento T149 y T165) (semilla fija; construye los datos con las funciones base `allocateByWeights`/`clampChargeDay` y un calendario propio documentado para MSI y fijos, cuya coherencia con el dominio verifica T167) y relativo a "hoy" que produce ≈ 6 meses de ingresos con asignaciones (usando `allocateByWeights`), gastos manuales, fijos aplicados, pagos de tarjeta, una compra MSI con mensualidades, metas e instantáneas de patrimonio; sin datos reales del propietario
- [X] T041 Implementar `src/data/mock/provider.ts` (`createMockProvider`) con lecturas reales sobre el almacén, `auth.getSession` sintética y `mode: 'demo'`, `capabilities: { canWrite: false }` y toda escritura delegando en `denyWrite`
- [X] T042 Crear `src/data/index.ts` con `createDataProvider()` según `contracts/data-provider.ts` (`import()` dinámico condicionado por `process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`) y `src/data/context.tsx` con `<DataProviderProvider>` y `useDataProvider()`
- [X] T159 [P] Escribir prueba que falle en `tests/unit/data/snapshot-cache.test.tsx`: `updateSnapshot` aplica el cambio de forma optimista antes de que responda el proveedor, revierte al estado previo si la mutación falla (incluido `DemoReadOnlyError`) y reconcilia con una invalidación de `queryKeys.snapshot` al terminar; los selectores por agregado reflejan el cambio al instante
- [X] T158 Crear `src/data/useFinanceSnapshot.ts` (única query de dominio con `loadSnapshot()`, clave `queryKeys.snapshot`, y selectores `select` por agregado) y `src/data/snapshot-cache.ts` con `updateSnapshot(queryClient, updater)` (`onMutate` optimista, rollback en `onError`, `invalidateQueries` en `onSettled`) para pasar T159; todo hook de dominio posterior lee y escribe a través de ellos (research.md R17)
- [X] T043 Escribir la suite compartida `tests/contract/data-provider.contract.ts` (lecturas devuelven tipos de dominio válidos con FKs resueltas; `loadSnapshot()` coherente con lecturas individuales; violaciones de suma → `VALIDATION`; `capabilities.canWrite` es true en Supabase y false en Mock) y ejecutarla en `tests/contract/mock.contract.test.ts`, donde además toda escritura lanza `DemoReadOnlyError` sin alterar el almacén
- [X] T044 Ejecutar la misma suite contra Supabase local en `tests/contract/supabase.contract.test.ts` (requiere `supabase start`; crea un usuario de prueba y limpia al terminar)

### Estado, i18n y shell de la aplicación

- [X] T045 [P] Crear `src/store/preferences.ts` según `contracts/ui-store.ts`: Zustand con `persist` (`pfa:prefs:v1`, `skipHydration`, `partialize`, `try/catch` en el almacenamiento) y selectores; y `src/store/ui.ts` (sidebar, diálogo activo, `waking`, `offline`)
- [X] T046 [P] Crear `src/i18n/config.ts` (locales `en`/`es`, defecto `en`), esqueletos `src/i18n/messages/en.json` y `src/i18n/messages/es.json` con el namespace `common`, y `src/i18n/format.ts` (`formatMoney`, `formatDate`, `formatPercent` por locale con `Intl`; único lugar permitido para `style: "currency"`)
- [X] T047 Crear `src/store/effects.tsx` (`<PreferencesEffects />`): rehidrata el store en el cliente y aplica `document.documentElement.lang`, `dataset.privacy` y la cookie `NEXT_LOCALE`
- [X] T048 [P] Crear `src/lib/query-client.ts`: `QueryClient` con reintentos exponenciales (hasta 4) para `OFFLINE`/`COLD_START`, `MutationCache.onError` que traduce `DemoReadOnlyError` a un toast "demo de solo lectura", y detección de consulta lenta (> 3 s) que activa `ui.waking`
- [X] T049 Crear `src/components/money/Money.tsx` y el hook `useMoneyFormatter()` según `contracts/ui-store.ts`: formatea con `src/i18n/format.ts`, enmascara con `selectShouldMask` ("••••" accesible + clase `.money`), y añadir en `src/app/globals.css` la regla `html[data-privacy="on"] .money { filter: blur(...) }`
- [X] T050 Crear `src/app/providers.tsx` (QueryClientProvider, DataProviderProvider, NextIntlClientProvider con ambos diccionarios, `<PreferencesEffects />`, `<Toaster />`) y conectarlo en `src/app/layout.tsx` leyendo la cookie `NEXT_LOCALE` para el idioma inicial
- [X] T051 Crear `src/middleware.ts` con refresco de sesión de `@supabase/ssr` y redirección a `/` si no hay sesión; no-op total cuando `env.isDemo` (usar `proxy.ts` si la versión de Next lo exige)
- [X] T052 Crear `src/app/page.tsx` (landing: formulario de login con Zod y botón "Explorar Demo / Reclutadores" que enlaza a `NEXT_PUBLIC_DEMO_URL`; en modo demo redirige al dashboard) y `src/features/auth/` (`LoginForm.tsx`, `useSession.ts`)
- [X] T053 Crear `src/app/(app)/layout.tsx` con `AppShell` en `src/components/layout/AppShell.tsx` (navegación a todas las rutas, alojamiento de los toggles de idioma, divisa y privacidad, indicador de `waking` y `offline`), más `src/app/not-found.tsx`, `src/app/error.tsx` y `src/app/(app)/loading.tsx`
- [X] T054 Crear el onboarding de primera ejecución en `src/features/settings/onboarding.ts`: si no hay categorías, crea las categorías y subcategorías por defecto (con `name_key`) y los valores por defecto de `user_settings`; idempotente; solo se ejecuta si `provider.capabilities.canWrite` (FR-047a)
- [X] T055 [P] Crear utilidades de pruebas en `tests/utils/` (`renderWithProviders.tsx` con el proveedor Mock y `fixtures.ts` con constructores de entidades de dominio)

**Checkpoint**: tipos, base de datos con RLS, ambos proveedores, estado, i18n base y shell listos; las historias pueden comenzar

---

## Phase 3: User Story 1 - Distribución automática de ingresos (Splitter) (Priority: P1) 🎯 MVP

**Goal**: configurar reglas de reparto y registrar ingresos que se fragmentan automáticamente en bolsas y vehículos de inversión con suma exacta.

**Independent Test**: configurar 50/30/20 con sub-reglas 90/10, registrar $20,000 recibidos el día 15 y verificar 10,000 / 6,000 / 3,600 / 400 financiando la quincena 16–fin de mes, con suma exacta.

### Tests for User Story 1 ⚠️

- [X] T056 [P] [US1] Escribir prueba que falle en `tests/unit/domain/splitter.test.ts`: escenarios US1-1/2 ($20,000 → 10,000/6,000/4,000; inversión 3,600/400), propiedad fast-check de suma exacta con reglas y montos arbitrarios, `RuleNotConfiguredError` sin regla, y `effectiveRule` elige la de mayor `effectiveFrom` ≤ fecha
- [X] T057 [P] [US1] Escribir prueba que falle en `tests/unit/domain/funded-period.test.ts`: `fundedPeriodFor` — día 15 → día 16 del mismo mes; último día de mes (28/29/30/31) → día 1 del mes siguiente; 31 de diciembre → 1 de enero del año siguiente (US1-5/6)
- [X] T058 [P] [US1] Escribir prueba de validación en `tests/unit/features/rule-schema.test.ts`: el esquema Zod rechaza porcentajes que no suman exactamente 100% (con mensaje que indica el faltante o excedente) y sub-reglas que no suman 100% cuando inversión > 0 (US1-3)

### Implementation for User Story 1

- [X] T059 [US1] Implementar `fundedPeriodFor` en `src/domain/periods.ts` para pasar T057
- [X] T060 [US1] Implementar `effectiveRule` y `splitIncome` en `src/domain/splitter.ts` (primero Needs/Wants/Inversión con `allocateByWeights`, luego el rubro de inversión entre sub-reglas; residuo a la bolsa de mayor porcentaje) para pasar T056
- [X] T061 [P] [US1] Crear esquemas Zod en `src/features/income/schemas.ts` (ingreso: `label` 1–80 caracteres, `amount` > 0, fecha válida) y `src/features/settings/rules/schema.ts` (Σ bps = 10000; sub-reglas Σ = 10000 si inversión > 0) para pasar T058
- [X] T062 [P] [US1] Crear hooks de TanStack Query en `src/features/income/hooks.ts` (`useIncomes`, `useRegisterIncome`, `useReplaceIncome`, `useDeleteIncome`; lecturas como selectores de `useFinanceSnapshot` y mutaciones con `updateSnapshot`) y en `src/features/settings/rules/hooks.ts` (`useRules`, `useSaveRule`)
- [X] T063 [US1] Crear la vista de reglas en `src/app/(app)/settings/rules/page.tsx` y `src/features/settings/rules/RuleForm.tsx`: porcentajes Needs/Wants/Inversión, sub-reglas por vehículo, indicador de suma y mensaje de diferencia; el guardado crea una regla nueva con `effective_from` de hoy, o de mañana si ya hay ingresos asociados a la regla vigente de hoy (la regla de ese día no se modifica) (no altera asignaciones previas, FR-005)
- [X] T064 [US1] Crear `src/features/income/RegisterIncomeDialog.tsx`: monto, fecha de recepción, quincena sugerida por `fundedPeriodFor` (editable), tipo recurrente/no recurrente con la opción "repartir por reglas" o "registrar sin repartir", vista previa del reparto y envío a `useRegisterIncome`; si no hay regla, ofrece configurarla o registrar sin repartir
- [X] T065 [US1] Crear `src/app/(app)/income/page.tsx` con la lista de ingresos y sus asignaciones por bolsa/vehículo (montos con `<Money>`), edición (recalcula con la regla original guardada en `rule_id`) y eliminación
- [X] T066 [P] [US1] Añadir las cadenas EN/ES del namespace `income` y `rules` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [X] T067 [US1] Escribir prueba e2e en `tests/e2e/us1-income-split.spec.ts` (proyecto `live`): configura reglas, registra $20,000 el día 15 y verifica las asignaciones y que guardar 50/30/30 se rechaza

**Checkpoint**: US1 funcional y comprobable de forma independiente

---

## Phase 4: User Story 2 - Semáforo de liquidez quincenal (Safe-to-Spend) (Priority: P1)

**Goal**: dashboard con saldo disponible por bolsa (Needs/Wants), arrastre entre quincenas, semáforo y días al próximo pago.

**Independent Test**: con asignación de Wants $3,000, fijo $500 y manuales $700, el Safe-to-Spend es $1,800; con $400 de sobrante previo y asignación $3,000, el inicial es $3,400 (o $2,600 con déficit de $400).

### Tests for User Story 2 ⚠️

- [X] T068 [P] [US2] Escribir prueba que falle en `tests/unit/domain/safe-to-spend.test.ts`: US2-1 ($1,800), US2-6 (arrastre ±$400 solo en Wants), cadena de varias quincenas, edición de un gasto pasado recalcula la cadena, gastos de terceros no entran, y `computeCarryChain` devuelve el cierre por quincena
- [X] T069 [P] [US2] Escribir prueba que falle en `tests/unit/domain/traffic-light.test.ts`: verde ≥ 50% de la base (`allocated + max(carryIn, 0)`), amarillo 20–49%, rojo < 20% o negativo, caso US2-7 (asignación $3,000 con arrastre +$1,000 y disponible $1,800 → amarillo), un arrastre negativo no aumenta la base, `neutral` si `base ≤ 0` y `available = 0`, rojo si `base ≤ 0` y `available < 0`, y umbrales configurables
- [X] T070 [P] [US2] Escribir prueba que falle en `tests/unit/domain/payday.test.ts`: `daysUntilNextPayday` con paydays 15 y 31 (fin de mes ajustado en meses cortos) y "hoy" siendo día de pago

### Implementation for User Story 2

- [X] T071 [US2] Implementar `src/domain/safe-to-spend.ts` con `trafficLight`, `computeCarryChain` y `computeSafeToSpend` según las fórmulas de `data-model.md` (arrastre derivado, `base = allocated + max(carryIn, 0)`, cargos de terceros excluidos) para pasar T068 y T069
- [X] T072 [US2] Implementar `daysUntilNextPayday` en `src/domain/periods.ts` para pasar T070
- [X] T073 [US2] Crear `src/features/safe-to-spend/useSafeToSpend.ts`: selector derivado sobre `useFinanceSnapshot()` (T158) (hoy en la zona horaria del usuario) que se recalcula al mutar cualquier gasto, ingreso o fijo, con `useMemo`
- [X] T074 [P] [US2] Crear `src/features/safe-to-spend/BucketCard.tsx` (saldo disponible con `<Money>`, barra de progreso, desglose arrastre/asignado/fijos pendientes y aplicados/manuales/aportaciones) y `TrafficLightBadge.tsx` (color + texto accesible, no solo color)
- [X] T075 [US2] Crear `src/app/(app)/dashboard/page.tsx`: tarjetas Needs y Wants, indicador de quincena actual, días al próximo pago, estados de carga (skeleton) y vacío (sin ingresos todavía), aviso de saldo negativo sin bloquear el registro (FR-021)
- [X] T076 [P] [US2] Añadir las cadenas EN/ES del namespace `dashboard` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [X] T077 [US2] Escribir prueba e2e en `tests/e2e/us2-safe-to-spend.spec.ts`: en los proyectos `demo` el dashboard muestra saldos y color por bolsa con los datos ficticios (solo lectura; un intento de registrar un gasto muestra el toast sin cambiar nada); en los proyectos `live` registrar un gasto actualiza el saldo y el color sin recargar la página (FR-018)

**Checkpoint**: US1 + US2 funcionan; el dashboard refleja las asignaciones

---

## Phase 5: User Story 3 - Gastos fijos con deducción programada (Priority: P1)

**Goal**: dar de alta gastos fijos que se reservan desde el inicio de la quincena como pendientes y se aplican solos en su día de cargo, sin duplicados.

**Independent Test**: dar de alta "Renta $8,000, día 1, Needs"; aparece pendiente desde el inicio de la quincena 1–15 y aplicado al llegar el día, sin cambiar el saldo ni duplicarse al reabrir la app.

### Tests for User Story 3 ⚠️

- [X] T078 [P] [US3] Escribir prueba que falle en `tests/unit/domain/recurring.test.ts`: `dueOccurrences` (todas las vencidas desde `starts_on`, respeta `ended_on`, idempotente al llamarse dos veces con el estado actualizado), día 31 en meses cortos → último día (FR-009), días 15/16 caen en su única quincena, `pendingOccurrences` solo fechas futuras de la quincena, pausado no genera ocurrencias, y editar el monto o el día de un fijo no modifica ni duplica las ocurrencias ya materializadas, solo las futuras (FR-011)
- [X] T079 [P] [US3] Escribir prueba que falle en `tests/unit/features/materialize.test.tsx`: `useMaterializeRecurring` inserta solo ocurrencias faltantes, no se ejecuta dos veces concurrentemente y el reintento no duplica (usa el índice único simulado en el proveedor de pruebas)

### Implementation for User Story 3

- [X] T080 [US3] Implementar `src/domain/recurring.ts` con `dueOccurrences` y `pendingOccurrences` (usa `clampChargeDay`) para pasar T078
- [X] T081 [P] [US3] Crear `src/features/recurring/schemas.ts` (Zod: `name` 1–80 caracteres, `amount` > 0, `chargeDay` 1–31, subcategoría obligatoria) y `src/features/recurring/hooks.ts` (`useRecurring`, `useCreateRecurring`, `useUpdateRecurring`, `useEndRecurring`, `useDeleteRecurring`; selectores de `useFinanceSnapshot` y mutaciones con `updateSnapshot`); `bucket` se copia de la categoría padre al guardar
- [X] T082 [US3] Crear `src/features/recurring/useMaterializeRecurring.ts`: efecto que, al cargar datos y solo si `provider.capabilities.canWrite` (FR-047a: en demo no hace nada ni muestra avisos), calcula `dueOccurrences`, inserta con `expenses.materializeRecurring` (origen `recurring`) y refresca la caché; con bloqueo para evitar ejecuciones simultáneas; montarlo en `src/app/(app)/layout.tsx`
- [X] T083 [US3] Integrar `pendingOccurrences` en `computeSafeToSpend` (`src/domain/safe-to-spend.ts`) como `fixedPending` y mostrar en el `BucketCard` los fijos "pendientes" y "aplicados" con estilos distintos (FR-008a)
- [X] T084 [US3] Crear `src/app/(app)/recurring/page.tsx` y `src/features/recurring/RecurringForm.tsx`: lista, alta, edición (solo afecta ocurrencias futuras), pausa/reanudación y eliminación; los cargos aplicados quedan marcados como "automático" en la bitácora
- [X] T085 [P] [US3] Añadir las cadenas EN/ES del namespace `recurring` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [X] T086 [US3] Escribir prueba e2e en `tests/e2e/us3-recurring.spec.ts` (proyecto `live`): crear la renta, recargar dos veces y comprobar una sola ocurrencia aplicada; pausar y verificar que ya no se deduce

**Checkpoint**: US1–US3 completas (todas las historias P1)

---

## Phase 6: User Story 4 - Registro de gastos con auto-clasificación (Priority: P2)

**Goal**: registrar gastos eventuales heredando la categoría macro, con soporte de pago con tarjeta (deuda) y registro de pagos de tarjeta.

**Independent Test**: registrar un gasto con subcategoría "Supermercado" (Needs) y verificar que baja la bolsa Needs sin elegir macro; con tarjeta, sube su deuda; el pago de la tarjeta baja la deuda sin tocar el Safe-to-Spend.

### Tests for User Story 4 ⚠️

- [X] T087 [P] [US4] Escribir prueba que falle en `tests/unit/domain/credit.test.ts`: `cardStatus` — deuda total = compras directas con la tarjeta + saldo pendiente completo de MSI a terceros − pagos; `payToAvoidInterest` = compras directas con fecha ≤ último corte + mensualidades de terceros con `cardDueOn` = próximo límite de pago − pagos posteriores a ese corte (mínimo 0; NO incluye mensualidades futuras); caso US10-1a ($3,000 de compras + MSI de $12,000 a 6 meses → pago $5,000 y deuda con $10,000 restantes del MSI); y US4-4/5 ($500 con tarjeta sube la deuda; su pago la baja y no cambia bolsas)
- [X] T088 [P] [US4] Escribir prueba de validación en `tests/unit/features/expense-schema.test.ts`: monto vacío, 0 o negativo rechazado (US4-3), `note` ≤ 200 caracteres, fecha obligatoria, subcategoría obligatoria

### Implementation for User Story 4

- [X] T089 [US4] Implementar `cardStatus` en `src/domain/credit.ts` (`lastCutOff`, `nextPaymentDue`, `totalDebt` con el saldo completo de los MSI y `payToAvoidInterest` solo con las mensualidades del estado vigente, según FR-029) para pasar T087
- [X] T090 [P] [US4] Crear `src/features/expenses/schemas.ts` (Zod para T088) y `src/features/expenses/hooks.ts` (`useExpenses(range)`, `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense`, `useCardPayments`, `useCreateCardPayment`) como selectores de `useFinanceSnapshot` y mutaciones con `updateSnapshot` (optimista); `bucket` hereda de la categoría de la subcategoría — nota: adelantado parcialmente en la Fase 4 (esquema, hooks y `AddExpenseDialog` para el e2e T077); se cierra en esta fase junto con T088
- [X] T091 [US4] Crear `src/features/expenses/AddExpenseDialog.tsx`: monto, fecha (por defecto hoy), subcategoría agrupada por categoría, método de pago (cuentas del catálogo), nota; muestra la bolsa heredada como texto informativo; un gasto con fecha en una quincena anterior afecta a esa quincena (US4-2) — nota: adelantado parcialmente en la Fase 4 (esquema, hooks y `AddExpenseDialog` para el e2e T077); se cierra en esta fase junto con T088
- [X] T092 [US4] Crear `src/features/expenses/CardPaymentDialog.tsx` (liquidación de deuda con tarjeta, cuenta de origen opcional, fecha) y `src/app/(app)/expenses/page.tsx` con la lista de gastos y pagos, edición y eliminación
- [X] T164 [US4] Crear `src/features/expenses/CardDebtSummary.tsx` (por tarjeta: deuda total, pago para no generar intereses y fecha límite, vía `cardStatus`) y montarlo en `src/app/(app)/expenses/page.tsx` para que la deuda suba con una compra con tarjeta y baje con su pago (US4-4/5)
- [X] T093 [P] [US4] Añadir las cadenas EN/ES del namespace `expenses` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [X] T094 [US4] Escribir prueba e2e en `tests/e2e/us4-expenses.spec.ts` (proyecto `live`): gasto en Wants baja el Safe-to-Spend y cambia el semáforo; gasto con tarjeta y su pago cumplen US4-4/5 (el resumen de deuda de `CardDebtSummary` sube y baja y el Safe-to-Spend no cambia con el pago)

**Checkpoint**: gastos funcionales y el Safe-to-Spend los refleja

---

## Phase 7: User Story 5 - Cuentas por cobrar y MSI a terceros (Priority: P2)

**Goal**: registrar compras a MSI para terceros, con calendario de cobros anticipado al límite de pago, alertas al abrir la app y aislamiento de las métricas personales.

**Independent Test**: registrar $12,000 a 6 MSI para un deudor; 6 mensualidades de $2,000 con fecha de cobro antes del límite de pago; marcar una cobrada no cambia el Safe-to-Spend; el gasto personal no cambia.

### Tests for User Story 5 ⚠️

- [X] T095 [P] [US5] Escribir prueba que falle en `tests/unit/domain/installments.test.ts`: `splitInstallments` (Σ = total, residuo en la última, plazo 1 mes), `buildCollectionSchedule` (`dueOn < cardDueOn` siempre, `dueOn = cardDueOn − collectionLeadDays`, estado de cuenta correcto según corte y compra cerca del corte), `debtorBalance`, y `collectionAlerts` (vencidos con `daysUntilDue` negativo y ventana fija `COLLECTION_ALERT_WINDOW_DAYS = 7`)
- [X] T096 [P] [US5] Escribir prueba que falle en `tests/unit/domain/third-party-isolation.test.ts`: con cargos de terceros registrados, `computeSafeToSpend` y las métricas de gasto personal quedan idénticas (US5-5, SC-007), y el cobro de una mensualidad no cambia el Safe-to-Spend (US5-6a)

### Implementation for User Story 5

- [X] T097 [US5] Implementar `src/domain/installments.ts` (`splitInstallments`, `buildCollectionSchedule`, `debtorBalance`, `collectionAlerts`) para pasar T095
- [X] T098 [P] [US5] Crear `src/features/receivables/schemas.ts` (Zod: `description` 1–120 caracteres, `total` > 0, `termMonths` 1–48, deudor y tarjeta obligatorios; la tarjeta debe ser `credit_card`) y `src/features/receivables/hooks.ts` (`useReceivables`, `useDebtors`, `useCreateReceivable`, `useRecordCollection`, `useCreateDebtor`; selectores de `useFinanceSnapshot` y mutaciones con `updateSnapshot`)
- [X] T099 [US5] Crear `src/features/receivables/AddReceivableDialog.tsx` con vista previa del calendario (monto, fecha de cobro y límite de pago por mensualidad) usando `buildCollectionSchedule`, y envío por la RPC atómica
- [X] T100 [US5] Crear `src/features/receivables/CollectionDialog.tsx` (marcar mensualidad cobrada, parcial o pendiente; muestra "destinado al pago de la tarjeta") y `src/app/(app)/receivables/page.tsx` con calendario de cobros, saldo por deudor y detalle por compra (US5-6)
- [X] T101 [US5] Crear `src/features/receivables/CollectionAlerts.tsx` (alertas calculadas al abrir la app con deudor, monto y fecha; vencidos y próximos 7 días mediante la constante `COLLECTION_ALERT_WINDOW_DAYS`) y montarlo en `src/app/(app)/dashboard/page.tsx`
- [X] T102 [P] [US5] Añadir las cadenas EN/ES del namespace `receivables` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [X] T103 [US5] Escribir prueba e2e en `tests/e2e/us5-receivables.spec.ts` (proyecto `live`): flujo completo de MSI y verificación de que el Safe-to-Spend no cambia

**Checkpoint**: MSI a terceros funcional y aislado

---

## Phase 8: User Story 6 - Visualización multi-divisa con tipo de cambio (Priority: P2)

**Goal**: ver todos los montos en MXN, USD o EUR con la paridad vigente, degradando a MXN si la API falla.

**Independent Test**: con patrimonio de $100,000 MXN y tasa 17.00 MXN/USD, USD muestra $5,882.35; al volver a MXN los datos son idénticos; sin API se sigue en MXN con aviso.

### Tests for User Story 6 ⚠️

- [X] T104 [P] [US6] Escribir prueba que falle en `tests/unit/domain/fx.test.ts`: `convert` con redondeo half-up ($100,000 MXN a tasa USD 1/17 → 588,235 centavos), MXN devuelve el mismo valor, `fx = null` devuelve MXN, e `isPlausibleRate` rechaza tasas ≤ 0, no finitas y variaciones > 20% vs la previa
- [X] T105 [P] [US6] Escribir prueba que falle en `tests/unit/features/fx-hook.test.tsx`: `useFxRates` consulta una vez por carga, guarda la última tasa válida en `localStorage` con fecha, ante fallo devuelve la tasa previa con `stale: true`, y ante fallo sin tasa previa devuelve `null` sin lanzar error

### Implementation for User Story 6

- [X] T106 [US6] Implementar `src/domain/fx.ts` (`convert`, `isPlausibleRate`) para pasar T104
- [X] T107 [US6] Crear `src/features/fx/api.ts` (cliente de Frankfurter como fuente primaria con `open.er-api.com` de respaldo; solo base MXN y símbolos USD/EUR; sin enviar datos del usuario) y `src/features/fx/storage.ts` (persistencia segura en `localStorage` con `try/catch`)
- [X] T108 [US6] Implementar `src/features/fx/useFxRates.ts` (TanStack Query con `staleTime` largo y reintentos, validación con `isPlausibleRate`, estado `stale`) para pasar T105; mismo comportamiento en demo y live (no ramifica por modo; la demo también consulta la API pública, sin datos del usuario)
- [X] T109 [US6] Integrar la conversión en `src/components/money/Money.tsx` y `useMoneyFormatter` (usa `displayCurrency` del store y `convert`; los datos originales no cambian) y crear `src/components/layout/CurrencyToggle.tsx` montado en el `AppShell`
- [X] T110 [US6] Crear `src/features/fx/FxStatus.tsx`: muestra la tasa vigente usada (publicada por la fuente, normalmente diaria) y su fecha/hora de actualización, aviso de "tasa no disponible/no actualizada" con botón de reintento, y vuelve a MXN si no hay tasa (FR-036)
- [X] T111 [P] [US6] Añadir las cadenas EN/ES del namespace `fx` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [X] T112 [US6] Escribir prueba e2e en `tests/e2e/us6-currency.spec.ts` (proyecto `demo`): alternar MXN/USD/EUR con tasas interceptadas, ver tasa y fecha, simular fallo de la API y comprobar que el aviso aparece en menos de 10 s (SC-009); la preferencia persiste al recargar

**Checkpoint**: multi-divisa funcional en todas las pantallas que usan `<Money>`

---

## Phase 9: User Story 7 - Alternancia de idioma EN/ES (Priority: P2)

**Goal**: interfaz en inglés por defecto con cambio instantáneo a español, sin perder estado y con formato localizado.

**Independent Test**: primera visita en EN; activar ES cambia todos los textos (incluidos errores y toasts) sin recargar ni perder un formulario a medias; la preferencia persiste.

### Tests for User Story 7 ⚠️

- [X] T113 [P] [US7] Escribir prueba que falle en `tests/unit/i18n/parity.test.ts`: `en.json` y `es.json` tienen exactamente las mismas claves, ninguna cadena vacía y los mismos marcadores de interpolación
- [X] T114 [P] [US7] Escribir prueba que falle en `tests/unit/i18n/format.test.ts`: `formatMoney`, `formatDate` y `formatPercent` siguen las convenciones de `en-US` y `es-MX`

### Implementation for User Story 7

- [X] T115 [US7] Completar `src/i18n/messages/en.json` y `src/i18n/messages/es.json` con todos los namespaces restantes (navegación, errores de validación, toasts, estados vacíos, nombres de categorías por defecto vía `name_key`) hasta que T113 pase — nota: completo para todas las pantallas existentes; las historias pendientes (US8–US10) añaden su namespace y la regla `react/jsx-no-literals` impide texto sin traducir
- [X] T116 [US7] Crear `src/components/layout/LanguageToggle.tsx` (interruptor EN/ES en el `AppShell` que llama `setLocale`) y asegurar que `NextIntlClientProvider` en `src/app/providers.tsx` reacciona al locale del store sin remontar las páginas
- [X] T117 [US7] Verificar y completar el formato por idioma en `src/i18n/format.ts` (números, divisa, fechas) y reemplazar cualquier cadena literal restante en `src/**/*.tsx` por claves de traducción; añadir en `eslint.config.mjs` una regla contra texto literal en JSX
- [X] T118 [US7] Escribir prueba e2e en `tests/e2e/us7-language.spec.ts` (proyecto `demo`): inicia en EN, cambia a ES sin recarga, un formulario a medias conserva su contenido (también al cambiar la divisa de visualización con el formulario abierto), persiste tras recargar y las cookies hacen que el HTML inicial salga en ES

**Checkpoint**: bilingüismo completo

---

## Phase 10: User Story 8 - Configuración global, catálogo y bitácora (Priority: P3)

**Goal**: administrar cuentas/tarjetas, categorías y subcategorías, preferencias de cálculo, y consultar y exportar la bitácora.

**Independent Test**: crear una tarjeta con corte y límite de pago, una subcategoría vinculada a Wants y exportar la bitácora a CSV con todos los movimientos.

### Tests for User Story 8 ⚠️

- [ ] T119 [P] [US8] Escribir prueba que falle en `tests/unit/domain/ledger.test.ts`: `buildLedger` unifica ingresos (+), gastos y fijos (−), pagos de tarjeta (−) y cobros de terceros (+, `isThirdParty`), `filterLedger` por fecha, tipo, cuenta, bolsa y terceros
- [ ] T120 [P] [US8] Escribir prueba que falle en `tests/unit/domain/csv.test.ts`: `toCsv` con BOM UTF-8, escape RFC 4180 (comas, comillas y saltos de línea), montos en MXN con dos decimales sin conversión, y `snapshotToCsvBundle` incluye todas las entidades

### Implementation for User Story 8

- [ ] T121 [US8] Implementar `src/domain/ledger.ts` (`buildLedger`, `filterLedger`) y `src/domain/csv.ts` (`toCsv`, `snapshotToCsvBundle`) para pasar T119 y T120
- [ ] T122 [P] [US8] Crear `src/features/settings/accounts/schema.ts` (Zod: `name` 1–60 caracteres, tarjeta de crédito exige `cutOffDay` 1–31 y `paymentDueOffsetDays` 1–60), `hooks.ts` (selectores y mutaciones sobre `useFinanceSnapshot`/`updateSnapshot`) y `AccountForm.tsx`, y la página `src/app/(app)/settings/accounts/page.tsx` (alta, edición y archivo; el archivo de una tarjeta con MSI pendientes muestra el error `CONFLICT`)
- [ ] T123 [P] [US8] Crear `src/features/settings/taxonomy/schema.ts` (Zod: `name` 1–60 caracteres), `hooks.ts` (selectores y mutaciones sobre `useFinanceSnapshot`/`updateSnapshot`) y `TaxonomyEditor.tsx`, y la página `src/app/(app)/settings/categories/page.tsx` (crear categorías y subcategorías vinculadas a un padre; eliminar una subcategoría con movimientos exige reasignar o se bloquea, US8-4)
- [ ] T124 [P] [US8] Crear `src/features/settings/preferences/PreferencesForm.tsx` y la página `src/app/(app)/settings/preferences/page.tsx` (umbrales del semáforo con `yellow_min_bps < green_min_bps`, días de anticipación de cobro 0–15, meses del fondo de emergencia 1–36, días de pago, zona horaria)
- [ ] T125 [US8] Crear `src/app/(app)/ledger/page.tsx` y `src/features/ledger/LedgerTable.tsx` y `LedgerFilters.tsx`: bitácora filtrable por fecha, categoría, cuenta, tipo y "terceros", con paginación en cliente
- [ ] T126 [US8] Crear `src/features/ledger/ExportButton.tsx` ("Exportar datos") que genera el CSV en el navegador desde el snapshot en caché de `useFinanceSnapshot()` (T158; sin una segunda descarga) con `Blob` y descarga; montarlo en la bitácora y en `src/app/(app)/settings/page.tsx` (índice de configuración con enlaces a reglas, cuentas, categorías, preferencias y exportación)
- [ ] T127 [P] [US8] Añadir las cadenas EN/ES de los namespaces `settings` y `ledger` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [ ] T128 [US8] Escribir prueba e2e en `tests/e2e/us8-settings-ledger.spec.ts` (proyecto `live`): alta de tarjeta y subcategoría, filtros de la bitácora y descarga del CSV con el número esperado de filas

**Checkpoint**: configuración, bitácora y respaldo completos

---

## Phase 11: User Story 9 - Privacidad y modo demo para reclutadores (Priority: P3)

**Goal**: Modo Privacidad global que enmascara todo importe y acceso al demo de solo lectura sin llamadas a Supabase.

**Independent Test**: con privacidad activa, ningún importe es legible en ninguna ruta; en el demo, cualquier escritura muestra el toast de solo lectura sin persistir, y no hay peticiones a `*.supabase.co`.

### Tests for User Story 9 ⚠️

- [ ] T129 [P] [US9] Escribir prueba que falle en `tests/unit/components/money.test.tsx`: `<Money>` enmascara cuando `privacyMode` es true o cuando no está hidratado fuera de demo, no enmascara en demo sin privacidad, y el texto accesible es "••••"
- [ ] T130 [P] [US9] Escribir prueba e2e en `tests/e2e/us9-demo.spec.ts` (proyecto `demo`): el botón de entrada lleva al dashboard, toda acción de crear/editar/eliminar muestra el toast de solo lectura sin cambiar datos, y un listener de red falla la prueba ante cualquier petición a `supabase.co`
- [ ] T131 [P] [US9] Escribir prueba e2e en `tests/e2e/us9-privacy.spec.ts` (proyecto `demo`): con privacidad activa recorre todas las rutas de `(app)` y verifica que ningún texto con patrón de importe es legible (incluidos ejes y tooltips de gráficas) y que la preferencia persiste al recargar
- [ ] T163 [P] [US9] Escribir prueba e2e en `tests/e2e/us9-demo-background.spec.ts` (proyectos `demo-en` y `demo-es`): al cargar cada ruta de `(app)` existente hasta ese momento (la cobertura completa llega con T162 y T161 en Polish) no aparece ningún toast ni error y no hay intentos de escritura automáticos; solo las acciones del usuario producen el toast de solo lectura

### Implementation for User Story 9

- [ ] T132 [US9] Crear `src/components/layout/PrivacyToggle.tsx` (control accesible con `aria-pressed` montado en el `AppShell`) y verificar que `<PreferencesEffects />` aplica `data-privacy`
- [ ] T133 [US9] Crear `src/components/charts/MaskedAxis.tsx` y el hook de formateo de ejes y tooltips basado en `useMoneyFormatter` para que las gráficas (Recharts) muestren "••••" con privacidad activa; documentar en `src/components/charts/README.md` que los importes de gráficas deben pasar por él
- [ ] T134 [US9] Crear `src/components/layout/DemoBanner.tsx` (aviso persistente de "demo de solo lectura" con enlace al repositorio) y comportamiento de entrada del demo: en `src/app/page.tsx` el botón "Explorar Demo / Reclutadores" apunta a `NEXT_PUBLIC_DEMO_URL` en el despliegue personal y a `/dashboard` en el demo
- [ ] T135 [US9] Verificar el manejo global de escrituras en demo: añadir en `src/lib/query-client.ts` una prueba de que un `DemoReadOnlyError` en cualquier mutación produce un único toast, y bloquear en los formularios el envío visual (estado de envío se restablece sin error)
- [ ] T136 [US9] Crear `scripts/check-demo-bundle.mjs` que tras `next build` con `NEXT_PUBLIC_DEMO_MODE=true` falla si el bundle del cliente contiene `supabase.co`, `@supabase` o claves; añadirlo a `package.json` como `check:demo-bundle` y al CI
- [ ] T137 [P] [US9] Añadir las cadenas EN/ES del namespace `privacy` y `demo` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`

**Checkpoint**: privacidad y demo verificados con pruebas automáticas

---

## Phase 12: User Story 10 - Crédito, patrimonio y metas (Priority: P3)

**Goal**: línea de tiempo de pagos y fechas límite con el pago "totalero" destacado, fondo de emergencia, apartados y gráfica de patrimonio neto.

**Independent Test**: con una tarjeta con saldo, la línea de tiempo muestra el pago para no generar intereses y su fecha límite; un apartado de $12,000 anuales retiene $1,000 al mes; la gráfica muestra la evolución mensual.

### Tests for User Story 10 ⚠️

- [ ] T138 [P] [US10] Escribir prueba que falle en `tests/unit/domain/credit-timeline.test.ts`: `creditTimeline` mezcla días de pago, límites de pago de tarjeta y cobros a deudores ordenados por fecha en un rango, con el monto "totalero" en los eventos de tarjeta
- [ ] T139 [P] [US10] Escribir prueba que falle en `tests/unit/domain/goals.test.ts`: `dueContributions` (apartado $12,000 anual → $1,000 mensual, idempotente por `(goal_id, periodo)`, respeta archivo), `emergencyFundProgress` (meses cubiertos = ahorrado / gastos vitales, donde gastos vitales = promedio mensual de gastos aplicados en Needs de los últimos 3 meses completos; con menos historial usa los meses disponibles)
- [ ] T140 [P] [US10] Escribir prueba que falle en `tests/unit/domain/net-worth.test.ts`: `computeNetWorth` — activos = saldos iniciales de cuentas que no son tarjeta + asignaciones acumuladas a Inversión + aportaciones a metas desde Needs/Wants + mensualidades de terceros pendientes + saldo disponible actual de Needs y Wants (con signo); pasivos = deuda total de tarjetas (con saldo completo de MSI); y la instantánea mensual es idempotente

### Implementation for User Story 10

- [ ] T141 [US10] Implementar `creditTimeline` en `src/domain/credit.ts` para pasar T138
- [ ] T142 [US10] Implementar `src/domain/goals.ts` (`dueContributions`, `emergencyFundProgress`) para pasar T139 e integrar `goalContributions` por `source_bucket` en `src/domain/safe-to-spend.ts` (solo Needs/Wants afectan el Safe-to-Spend)
- [ ] T143 [US10] Implementar `src/domain/net-worth.ts` (`computeNetWorth`) para pasar T140
- [ ] T144 [P] [US10] Crear `src/features/credit/CreditTimeline.tsx` y la página `src/app/(app)/credit/page.tsx`: línea de tiempo visual con el "Pago para no generar intereses" destacado como monto principal y sin promover el pago mínimo
- [ ] T145 [P] [US10] Crear `src/features/goals/schemas.ts` (Zod: `name` 1–80 caracteres, `targetMonths` 1–36, `annual` y `monthly` > 0 para apartados), `hooks.ts`, `useMaterializeContributions.ts` (idempotente, mismo mecanismo que los fijos; solo si `provider.capabilities.canWrite`) y la página `src/app/(app)/goals/page.tsx` con fondo de emergencia, apartados y su bolsa de origen configurable (por defecto: apartados → Needs, fondo de emergencia → Inversión)
- [ ] T146 [P] [US10] Crear `src/features/net-worth/useNetWorthSnapshot.ts` (instantánea mensual al abrir la app, solo si `provider.capabilities.canWrite`) y `src/features/net-worth/NetWorthChart.tsx` con la página `src/app/(app)/net-worth/page.tsx` (activos, deudas y patrimonio neto históricos con ejes enmascarables)
- [ ] T147 [P] [US10] Añadir las cadenas EN/ES de los namespaces `credit`, `goals` y `netWorth` en `src/i18n/messages/en.json` y `src/i18n/messages/es.json`
- [ ] T148 [US10] Escribir prueba e2e en `tests/e2e/us10-credit-goals.spec.ts` (proyecto `demo`): la línea de tiempo muestra el pago sin intereses, el apartado y la gráfica de patrimonio cargan con los datos ficticios

**Checkpoint**: todas las historias funcionan de forma independiente

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: calidad, rendimiento, accesibilidad y despliegue

- [ ] T149 [P] Escribir prueba de rendimiento en `tests/unit/perf/safe-to-spend.perf.test.ts`: `computeSafeToSpend` con 5 años de datos (≈ 10 mil movimientos) en < 50 ms (Performance Goals del plan), usando `generateHistory(5)` exportado por `src/data/mock/seed.ts` (5 años de datos sintéticos)
- [ ] T150 [P] Escribir prueba e2e de cold start en `tests/e2e/cold-start.spec.ts` (proyecto `live`): con respuestas retrasadas o 503 se muestran skeletons y "Despertando la base de datos…", se reintenta y no aparece error crudo; sin conexión, la app muestra datos en caché y bloquea escrituras con aviso
- [ ] T151 [P] Auditoría de interfaz con las skills `ui-ux-pro-max` e `impeccable`: contraste, alineación y responsividad móvil (gutter de 16 px, sin scroll horizontal); aplicar correcciones en `src/components/` y `src/features/`
- [ ] T152 [P] Auditoría de accesibilidad: navegación por teclado, `aria-live` para toasts y semáforo (no solo color), etiquetas de formularios en EN/ES
- [ ] T153 Revisión de seguridad: confirmar que ninguna ruta usa la clave `service_role`, que `supabase/config.toml` mantiene `enable_signup = false`, que `.env*` no está versionado y revisar los asesores de seguridad y rendimiento de Supabase (panel > Advisors o la herramienta `get_advisors` del MCP de Supabase) y ejecutar `supabase db lint` sobre las migraciones
- [ ] T154 Revisión de cumplimiento de la constitución: recorrer el *Constitution Check* de `plan.md` contra el código final (sin `any`, `@supabase` solo en `src/data/supabase`, ningún importe fuera de `<Money>`, sin cron ni subida de archivos, ninguna lectura de `provider.mode` fuera de la lista permitida, sin SDK de analítica/telemetría ni `console.*` con datos, Principio V) y registrar desviaciones en el plan
- [ ] T155 Ejecutar `specs/001-personal-finances-core/quickstart.md` completo (escenarios A–H) en modo demo y modo personal y en ambos idiomas y marcar los criterios de salida
- [ ] T156 [P] Redactar `README.md` en la raíz (propósito de portafolio, arquitectura Zero-Cost, cómo correr demo y modo personal, estructura de carpetas, decisiones clave) y `docs/deploy.md` (dos proyectos de Vercel del mismo repo con `NEXT_PUBLIC_DEMO_MODE` distinto, creación del único usuario en Supabase, respaldo con "Exportar datos")
- [ ] T160 [P] Crear `scripts/check-no-uploads.mjs` que falla si `src/` contiene `type="file"`, `FileReader`, `supabase.storage` o columnas binarias (`bytea`) en `supabase/migrations/`; añadir el script `check:no-uploads` en `package.json` y al CI (FR-044)
- [ ] T161 Escribir `tests/e2e/matrix.spec.ts` que ejecuta en los cuatro proyectos (`demo-en`, `demo-es`, `live-en`, `live-es`; la rama `live` omite lo que no aplica) los flujos P1 y los toggles: dashboard con semáforo, registro/lectura de ingreso, fijos pendientes/aplicados, idioma, divisa y privacidad; sin cadenas sin traducir ni importes legibles con privacidad activa (puerta de calidad de la constitución)
- [ ] T162 [P] Escribir prueba que falle en `tests/unit/features/background-writers.test.tsx` con un proveedor de `capabilities.canWrite = false`: `useMaterializeRecurring`, `useMaterializeContributions`, `useNetWorthSnapshot` y el onboarding (T054) no llaman a ninguna escritura y no producen toasts (FR-047a); se ejecuta tras US3 y US10, cuyos hooks prueba
- [ ] T165 [P] Escribir `tests/unit/perf/export.perf.test.ts`: con `generateHistory(5)` (T149), `snapshotToCsvBundle` + `toCsv` generan el CSV completo en < 10 s (SC-013) y el CSV tiene una fila por movimiento
- [ ] T166 Escribir `tests/e2e/perf-budgets.spec.ts` (proyectos `demo-*` y `live-*`, con datos del Mock o semilla local): registrar un gasto con teclado en < 20 s (SC-002), dashboard con saldos visibles < 5 s tras cargar (SC-003), saldo actualizado < 1 s tras guardar (SC-004, solo `live`) y cambio de idioma < 1 s (SC-010)
- [ ] T167 [P] Escribir `tests/unit/data/mock-seed-consistency.test.ts`: los datos de `seed.ts` cumplen las invariantes del dominio (asignaciones y mensualidades suman exacto, `dueOn < cardDueOn`, fijos aplicados coinciden con `dueOccurrences`, ninguna fecha futura aplicada) usando las funciones de `src/domain`
- [ ] T157 Limpieza final: eliminar código muerto, verificar que `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:contract`, `supabase test db` y `pnpm test:e2e` pasan en verde, y que `pnpm check:demo-bundle` no encuentra rastros de Supabase

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; T001 → T002 → T003, el resto en paralelo tras T001
- **Foundational (Phase 2)**: depende de Setup y BLOQUEA todas las historias. Orden interno: tipos/dominio base (T013–T018) y migraciones (T019–T023) pueden ir en paralelo; los repos de Supabase (T030–T036) dependen de T026–T029 y de las migraciones; el Mock (T038–T041) depende de T013, T016 y T026; T042 depende de T037 y T041; T158/T159 (caché única `useFinanceSnapshot`) dependen de T042 y bloquean todos los hooks de dominio de las historias; el shell (T049–T054) depende de T045–T048
- **User Stories (Phase 3+)**: todas dependen de Foundational completa
- **Polish (Phase 13)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias
- **US2 (P1)**: tras Foundational; consume asignaciones de US1 y fijos de US3 en tiempo de ejecución, pero `computeSafeToSpend` funciona con listas vacías y es comprobable de forma independiente con datos del Mock
- **US3 (P1)**: tras Foundational; T083 modifica `src/domain/safe-to-spend.ts` de US2 (hacerlo después de T071)
- **US4 (P2)**: tras Foundational; `cardStatus` (T089) es reutilizado por US5 y US10
- **US5 (P2)**: tras Foundational; depende de T089 para la deuda de tarjeta con cargos de terceros
- **US6 (P2)**: tras Foundational; modifica `Money.tsx` de Foundational (T109)
- **US7 (P2)**: tras Foundational; T115 es más fácil después de completar las cadenas de US1–US6, pero sus claves pueden completarse al final
- **US8 (P3)**: tras Foundational; las cuentas y categorías creadas aquí alimentan US3–US5 (el onboarding T054 ya provee valores por defecto)
- **US9 (P3)**: tras Foundational; T131 recorre las rutas de todas las historias implementadas
- **US10 (P3)**: tras Foundational; T142 modifica `src/domain/safe-to-spend.ts`; reutiliza T089

### Within Each User Story

- Las pruebas se escriben primero y deben fallar
- Lógica de dominio → esquemas y hooks → vistas UI → cadenas i18n → e2e
- Cada historia se cierra antes de pasar a la siguiente prioridad

### Parallel Opportunities

- Setup: T004–T010 y T012 en paralelo tras T001–T003
- Foundational: T013–T015, T017, T024–T027, T030–T036 (repos Supabase), T038–T039, T045–T046, T048 y T055 en paralelo
- Dentro de cada historia: todas las pruebas [P] juntas; esquemas, hooks y cadenas i18n [P] en paralelo
- Tras Foundational, US1–US3 pueden repartirse entre desarrolladores; los archivos compartidos (`safe-to-spend.ts`, `Money.tsx`, `en.json`/`es.json`) requieren coordinar el orden

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo:
Task: "T056 Prueba de splitter en tests/unit/domain/splitter.test.ts"
Task: "T057 Prueba de fundedPeriodFor en tests/unit/domain/funded-period.test.ts"
Task: "T058 Prueba de esquema de reglas en tests/unit/features/rule-schema.test.ts"

# Tras implementar el dominio (T059–T060), en paralelo:
Task: "T061 Esquemas Zod en src/features/income/schemas.ts y src/features/settings/rules/schema.ts"
Task: "T062 Hooks de ingresos y reglas en src/features/income/hooks.ts"
Task: "T066 Cadenas EN/ES de income y rules"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3, todas P1)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO)
3. Completar US1 → US2 → US3 (distribución, Safe-to-Spend y fijos)
4. **DETENERSE Y VALIDAR**: escenarios 1–5 del Escenario B del quickstart en modo demo y local
5. Desplegar la demo y el modo personal si está listo

> US1 por sí sola es el mínimo demostrable (ingresos repartidos), pero el valor central del producto ("¿cuánto puedo gastar hoy?") se completa con US1+US2+US3.

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → US2 → US3 → MVP desplegable
3. US4 (gastos y tarjetas) → US5 (MSI) → US6 (divisa) → US7 (idioma): cada una añade valor sin romper las anteriores
4. US8 (configuración y respaldo) → US9 (privacidad y demo público) → US10 (crédito, metas y patrimonio)
5. Polish y despliegue

### Parallel Team Strategy

Con varias personas, tras Foundational: A toma US1+US3, B toma US2 y US4, C toma US6+US7; US5, US8–US10 después. Coordinar los archivos compartidos mencionados arriba.

---

## Notes

- [P] = archivos distintos, sin dependencias incompletas
- La etiqueta [Story] vincula cada tarea con su historia para trazabilidad
- Verificar que las pruebas fallan antes de implementar
- Confirmar con commits pequeños tras cada tarea o grupo lógico
- Evitar: tareas vagas, conflictos en el mismo archivo, dependencias entre historias que rompan su independencia
- Aclaraciones resueltas por criterio simple (2026-11-01): base del semáforo, ventana de alertas de 7 días, gastos vitales, fórmula de patrimonio neto, "tasa vigente" y pago "totalero" con MSI; ver spec.md (sección Clarifications) y research.md (R13, R14, R17)
