# Implementation Plan: Personal Finances Core

**Branch**: `001-personal-finances-core` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-personal-finances-core/spec.md`

## Summary

Aplicación web de finanzas personales (un solo propietario) que reparte ingresos por reglas, reserva gastos fijos
y muestra un Safe-to-Spend quincenal, además de gestionar tarjetas, cuentas por cobrar (MSI a terceros),
metas y patrimonio neto. Es bilingüe (EN/ES), multi-divisa de visualización (MXN/USD/EUR) y tiene un modo demo
de solo lectura.

Enfoque técnico:

- **Next.js App Router + TypeScript estricto**, 100% renderizado y calculado en el cliente tras la autenticación.
  No hay API routes ni funciones de servidor propias (Zero-Cost).
- **Motor de dominio puro** (`src/domain`): toda la aritmética financiera (reparto, quincenas, arrastre de saldos,
  Safe-to-Spend, MSI, conversión) son funciones puras sobre enteros (centavos), sin I/O y con pruebas
  de propiedades.
- **Capa de datos intercambiable** (`DataProvider`): una interfaz con dos implementaciones, `SupabaseProvider`
  (producción) y `MockProvider` (demo). Se elige en tiempo de compilación mediante `NEXT_PUBLIC_DEMO_MODE`, de modo
  que el bundle de la demo no contiene código de Supabase ni credenciales.
- **Supabase PostgreSQL con RLS** en todas las tablas; la base solo almacena datos y valida invariantes
  (sumas exactas, rangos, integridad entre usuarios); no calcula nada de negocio.
- **Estado**: TanStack Query para datos de servidor y tipos de cambio, con **una sola query de dominio** (`useFinanceSnapshot`)
  de la que leen todos los hooks por agregado (selectores) y que actualizan todas las mutaciones; Zustand para preferencias persistidas
  (idioma, divisa, privacidad) y estado efímero de UI.
- **Capacidades del proveedor**: `DataProvider.capabilities.canWrite` (false en demo). La UI y los hooks preguntan por capacidades, nunca por el
  tipo de proveedor; los procesos automáticos en segundo plano no se ejecutan cuando `canWrite` es false.

## Technical Context

**Language/Version**: TypeScript 5.x (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); Node.js 22 LTS

**Primary Dependencies**: Next.js (última versión estable, App Router), React, `@supabase/supabase-js` + `@supabase/ssr`, TanStack Query,
Zustand, next-intl, Zod, react-hook-form, Tailwind CSS, shadcn/ui, Framer Motion, Lucide React, Recharts (gráficas vía shadcn charts), `sonner` (toasts)

**Storage**: Supabase PostgreSQL (plan gratuito) con RLS; preferencias de dispositivo en `localStorage`; última paridad conocida en `localStorage`

**Testing**: Vitest (unitarias del dominio + pruebas de propiedades con fast-check), React Testing Library, pruebas de contrato del `DataProvider`
(mismas pruebas sobre Mock y Supabase local), pgTAP vía `supabase test db` (RLS e invariantes), Playwright (E2E en una **matriz modo {demo, live} × idioma {en, es}**)

**Target Platform**: Navegadores modernos (evergreen), móvil y escritorio; despliegue en Vercel (Hobby) para producción y demo

**Project Type**: Aplicación web (single project, App Router; sin backend propio)

**Performance Goals**: Safe-to-Spend recalculado en < 50 ms con 5 años de historial (≈ 10 mil movimientos); interacción percibida < 1 s (SC-004, SC-010);
exportación CSV de 5 años < 10 s (SC-013)

**Constraints**: Costo recurrente $0 (Vercel Hobby + Supabase Free: 500 MB DB, 1 GB storage, pausa por inactividad); sin cron ni servidor propio;
sin subida de archivos; el demo no realiza llamadas a Supabase; todos los montos en MXN (centavos enteros)

**Scale/Scope**: 1 usuario real; ≈ 11 tablas de datos, ≈ 10 pantallas, ≈ 10 mil filas en 5 años; demo con ≈ 6 meses de datos ficticios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación en este plan | Estado |
|-----------|---------------------------|--------|
| I. Zero-Cost | Solo Vercel Hobby + Supabase Free + API pública de FX. Sin cron, colas ni storage de archivos. Los fijos y las alertas se calculan al abrir la app; materialización idempotente (índice único). Exportar CSV y manejo de cold start incluidos. | ✅ |
| II. Next.js + TS estricto | `strict` + flags extra; montos como `Cents` (entero con marca) y porcentajes como `BasisPoints`; reparto con método de mayor residuo, sin `float`. TanStack Query + Zustand con la responsabilidad dividida. ESLint prohíbe `any` y `@ts-ignore` sin justificación. | ✅ |
| III. Supabase + RLS | Todas las tablas con `user_id` + RLS + política de propietario con `(select auth.uid())`; claves foráneas compuestas `(user_id, id)` impiden referencias entre usuarios; `anon` sin permisos; migraciones versionadas en `supabase/migrations`; solo la clave publicable en el cliente; registro de usuarios deshabilitado. | ✅ |
| IV. Aislamiento del demo | `DataProvider` único; fábrica resuelta en build con `NEXT_PUBLIC_DEMO_MODE`; `MockProvider` en memoria y de solo lectura (`DemoReadOnlyError` → toast); **la UI y los hooks usan `capabilities.canWrite`, no el tipo de proveedor** (los procesos automáticos se omiten sin avisos cuando es false); regla ESLint que prohíbe importar `@supabase/*` fuera de `src/data/supabase`; prueba E2E que verifica 0 peticiones a `*.supabase.co` en demo. | ✅ |
| V. Privacidad y cálculo en cliente | Todo derivado vive en `src/domain` (puro) y se ejecuta en el navegador; las RPC de Postgres solo validan e insertan de forma atómica. Un único componente `<Money>` renderiza importes y aplica el enmascarado vía `data-privacy`; los ejes de gráficas usan el mismo formateador. Sin analítica ni telemetría. La única llamada externa es la de FX, sin datos del usuario. | ✅ |
| VI. i18n y multi-divisa | next-intl con diccionarios EN/ES completos (prueba de paridad de claves), EN por defecto; almacenamiento solo en MXN (centavos); conversión solo de presentación con tasa cacheada y degradación a MXN. | ✅ |

**Re-evaluación post-diseño (Fase 1)**: sin violaciones. Se documentan dos puntos de atención (ver *Complexity Tracking*): las RPC transaccionales
y las claves foráneas compuestas, ambos justificados por integridad y seguridad.

## Project Structure

### Documentation (this feature)

```text
specs/001-personal-finances-core/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones y alternativas
├── data-model.md        # Fase 1: entidades, invariantes, estados, valores derivados
├── quickstart.md        # Fase 1: guía de ejecución y validación
├── contracts/
│   ├── README.md              # Índice de contratos
│   ├── db-schema.sql          # Esquema relacional + RLS + RPC (referencia de diseño para las migraciones)
│   ├── domain-types.ts        # Tipos del dominio (Cents, Period, entidades)
│   ├── domain-engine.ts       # Firmas del motor puro de cálculo
│   ├── data-provider.ts       # Interfaz DataProvider y repositorios
│   └── ui-store.ts            # Stores de Zustand (preferencias y UI)
└── tasks.md             # Fase 2 (/speckit-tasks; no se crea aquí)
```

### Source Code (repository root)

```text
personal-finances-app/
├── .env.example                      # Plantilla de variables (sin secretos)
├── .github/workflows/ci.yml          # typecheck, lint, unit, pgTAP, e2e demo (GitHub Actions gratis)
├── next.config.ts
├── tsconfig.json                     # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
├── eslint.config.mjs                 # no-explicit-any, no-restricted-imports (@supabase fuera de src/data/supabase)
├── supabase/
│   ├── config.toml                   # enable_signup = false
│   ├── migrations/                   # SQL versionado (derivado de contracts/db-schema.sql)
│   └── tests/                        # pgTAP: RLS, sumas exactas, aislamiento entre usuarios
├── src/
│   ├── middleware.ts                 # Refresco de sesión (proxy.ts en Next ≥ 16); no-op en demo
│   ├── app/
│   │   ├── layout.tsx                # Fuentes, <html lang data-privacy>, Providers
│   │   ├── page.tsx                  # Landing: login + "Explorar Demo / Reclutadores"
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── (app)/                    # Zona autenticada (o demo)
│   │       ├── layout.tsx            # AppShell: navegación, toggles EN/ES · divisa · privacidad, banner demo
│   │       ├── dashboard/page.tsx    # Safe-to-Spend, semáforo, próximos cobros/pagos
│   │       ├── income/page.tsx       # Registro y reparto de ingresos
│   │       ├── expenses/page.tsx     # Gastos eventuales
│   │       ├── recurring/page.tsx    # Gastos fijos
│   │       ├── receivables/page.tsx  # Cuentas por cobrar / MSI a terceros
│   │       ├── credit/page.tsx       # Línea de tiempo y pago para no generar intereses
│   │       ├── goals/page.tsx        # Fondo de emergencia y apartados
│   │       ├── net-worth/page.tsx    # Gráfica de patrimonio neto
│   │       ├── ledger/page.tsx       # Bitácora filtrable + exportar CSV
│   │       └── settings/             # reglas · categorías · cuentas · preferencias · exportar
│   ├── domain/                       # Motor puro (sin React, sin I/O)
│   │   ├── money.ts                  # Cents, BasisPoints, allocateByWeights (mayor residuo), add/sub
│   │   ├── periods.ts                # PeriodKey, periodOf, bounds, clampChargeDay, fundedPeriodFor
│   │   ├── splitter.ts               # splitIncome(amount, rule)
│   │   ├── recurring.ts              # dueOccurrences, pendingForPeriod
│   │   ├── safe-to-spend.ts          # cadena de arrastre + semáforo
│   │   ├── installments.ts           # splitInstallments, collectionSchedule
│   │   ├── credit.ts                 # statementBalance, payToAvoidInterest, timeline
│   │   ├── goals.ts                  # aportaciones, avance del fondo de emergencia
│   │   ├── net-worth.ts              # activos − deudas, snapshots mensuales
│   │   ├── fx.ts                     # convert, FxSnapshot, validación de tasas
│   │   ├── ledger.ts                 # unificación de movimientos y filtros
│   │   ├── csv.ts                    # serialización CSV (escape, BOM UTF-8)
│   │   ├── types.ts                  # tipos de dominio (contracts/domain-types.ts)
│   │   └── errors.ts
│   ├── data/
│   │   ├── provider.ts               # interfaz DataProvider (contracts/data-provider.ts)
│   │   ├── index.ts                  # createDataProvider(): resuelve por NEXT_PUBLIC_DEMO_MODE
│   │   ├── context.tsx               # <DataProviderProvider> + useDataProvider()
│   │   ├── useFinanceSnapshot.ts     # ÚNICA query de dominio (loadSnapshot) + selectores por agregado
│   │   ├── snapshot-cache.ts         # updateSnapshot(): actualización optimista, rollback e invalidación
│   │   ├── query-keys.ts
│   │   ├── errors.ts                 # DemoReadOnlyError, ValidationError, ColdStartError...
│   │   ├── supabase/
│   │   │   ├── client.ts             # createBrowserClient (única importación de @supabase)
│   │   │   ├── provider.ts
│   │   │   ├── repos/                # un repositorio por agregado
│   │   │   ├── mappers.ts            # fila SQL ⇄ tipo de dominio
│   │   │   └── database.types.ts     # generado con supabase gen types
│   │   └── mock/
│   │       ├── provider.ts           # MockProvider (solo lectura)
│   │       ├── store.ts              # almacén en memoria
│   │       ├── seed.ts               # generador determinista relativo a "hoy"
│   │       └── fixtures/             # catálogos, reglas, tarjetas, deudores
│   ├── features/                     # UI por funcionalidad (componentes + hooks de TanStack Query)
│   │   ├── income/ expenses/ recurring/ safe-to-spend/ receivables/
│   │   └── credit/ goals/ net-worth/ ledger/ settings/ fx/ auth/ demo/
│   ├── store/
│   │   ├── preferences.ts            # idioma, divisa, privacidad (persistido)
│   │   ├── ui.ts                     # sidebar, diálogos (efímero)
│   │   └── effects.tsx               # sincroniza <html lang data-privacy> y cookie de idioma
│   ├── i18n/
│   │   ├── messages/{en,es}.json
│   │   ├── config.ts                 # locales, default 'en'
│   │   └── format.ts                 # formatMoney/formatDate por locale
│   ├── components/
│   │   ├── ui/                       # shadcn/ui
│   │   ├── money/Money.tsx           # ÚNICO punto de renderizado de importes
│   │   ├── charts/                   # wrappers con ejes enmascarables
│   │   └── layout/                   # AppShell, LanguageToggle, CurrencyToggle, PrivacyToggle, DemoBanner
│   └── lib/
│       ├── env.ts                    # variables validadas con Zod
│       ├── query-client.ts           # reintentos con backoff, manejo de cold start
│       └── utils.ts
├── scripts/
│   ├── check-demo-bundle.mjs         # el bundle demo no contiene Supabase ni claves
│   └── check-no-uploads.mjs          # FR-044: sin <input type="file"> ni uso de Supabase Storage
└── tests/
    ├── unit/                         # dominio, i18n (paridad EN/ES), CSV
    ├── contract/                     # suite compartida del DataProvider (Mock y Supabase local)
    └── e2e/                          # Playwright: matriz modo × idioma; demo (solo lectura, 0 llamadas Supabase), flujos P1
```

**Structure Decision**: proyecto único Next.js (sin backend propio). La separación por capas (`domain` puro → `data` con proveedor
intercambiable → `features` de UI) permite probar la lógica financiera sin React ni red, hace trivial el aislamiento del demo y mantiene las
dependencias de Supabase en un solo directorio.

## Flujos de datos clave

1. **Arranque**: `createDataProvider()` (resuelto en build) → `DataProviderProvider` → `useFinanceSnapshot()` carga **una sola vez** todo el
   historial (`loadSnapshot()`) con reintentos y mensaje de "despertando la base de datos" tras 3 s; los hooks por agregado leen de esa query.
2. **Materialización de fijos**: si `capabilities.canWrite`, al tener datos `dueOccurrences()` calcula los cargos vencidos aún no aplicados y los inserta por lotes
   (`expenses.origin='recurring'`); el índice único `(recurring_expense_id, occurrence_date)` garantiza idempotencia aun con dos pestañas abiertas.
   Los fijos futuros de la quincena se muestran como "pendientes" (derivados, no persistidos).
3. **Registrar ingreso**: `splitIncome()` calcula las asignaciones en el cliente → `register_income` (RPC) inserta ingreso + asignaciones en una
   transacción; un trigger diferido rechaza sumas distintas del monto.
4. **Safe-to-Spend**: selector derivado `computeSafeToSpend()` sobre `useFinanceSnapshot`; toda mutación llama a `updateSnapshot()`
   (optimista, rollback en error, invalidación al terminar), de modo que el saldo cambia de inmediato (SC-004).
5. **Divisa**: `useFxRates()` (TanStack Query, `staleTime` largo, persistencia local de la última tasa) + `<Money>` convierte solo para mostrar.
6. **Demo**: mismas pantallas; el `MockProvider` responde las lecturas y toda escritura iniciada por el usuario lanza `DemoReadOnlyError`, capturada
   globalmente por el `MutationCache` de TanStack Query, que muestra el toast de solo lectura. Los procesos automáticos (fijos, aportaciones,
   instantáneas, onboarding) consultan `capabilities.canWrite` y se omiten sin avisos (FR-047a). El FX usa el mismo código en ambos modos.

## Puerta de calidad: matriz modo × idioma

La constitución exige verificar toda funcionalidad en modo normal y demo, y en ambos idiomas. Playwright define cuatro proyectos
(`demo-en`, `demo-es`, `live-en`, `live-es`); los flujos P1 y los toggles se ejecutan en los cuatro (`tests/e2e/matrix.spec.ts`) y las pruebas
específicas de cada historia declaran en qué proyectos corren. CI falla si cualquiera de los cuatro falla.

## Complexity Tracking

> Sin violaciones de la constitución. Se registran decisiones que añaden complejidad deliberada.

| Decisión | Por qué es necesaria | Alternativa más simple rechazada porque |
|----------|----------------------|-----------------------------------------|
| RPC `register_income`, `create_receivable`, `save_distribution_rule` | Insertar cabecera + detalle de forma atómica (sin ingresos huérfanos ni sumas descuadradas) en el plan gratuito, sin servidor propio. No contienen lógica de negocio. | Inserciones múltiples desde el cliente pueden dejar datos a medias si falla la red a mitad de camino. |
| Claves foráneas compuestas `(user_id, id)` | Garantiza a nivel de BD que ninguna fila referencia datos de otro usuario aunque falle una política. | Claves simples dependen solo de RLS; un error de política permitiría referencias cruzadas. |
| Dos implementaciones de `DataProvider` con suite de contrato compartida | Es el mecanismo exigido por el Principio IV; la suite evita que Mock y Supabase diverjan. | Mockear solo en pruebas dejaría la demo sin garantía de paridad con producción. |
