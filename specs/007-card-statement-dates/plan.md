# Implementation Plan: Fechas de corte y pago de tarjetas desde el estado de cuenta

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-card-statement-dates/spec.md`

## Summary

Tres cambios:
- El dueño configura cada tarjeta con las dos fechas de un estado de cuenta, y la app deriva el día de corte y los días para pagar.
- Todo límite de pago se recorre al día hábil anterior si cae en fin de semana o día inhábil bancario de México.
- Las mensualidades MSI no cobradas se reprograman cuando cambian los términos de su tarjeta.

**Enfoque**:
- **Dominio puro nuevo**:
  - `src/domain/business-days.ts`: Pascua y los 11 inhábiles, memorizados por año.
  - `src/domain/card-terms.ts`: `dueDateFor`, `cardTermsFromStatement`, avisos, vista previa, prellenado y `rescheduleCardInstallments`.
- **`credit.ts`, `installments.ts` y el seed del demo** usan `dueDateFor`; desaparecen las cuatro copias de `corte + días`.
- **UI**: `CardTermsFields` dentro de `AccountForm`.
  - Modo "fechas del estado" por defecto, con vista previa de 3 estados y avisos.
  - Modo manual como opción.
  - La salida del esquema no cambia.
- **Datos**: la RPC atómica `update_account_with_installments` (migración `0010`, solo una función, sin cambio de esquema).
  - `accounts.update` gana un argumento opcional `reschedule`.
  - `useUpdateAccount` lo calcula al cambiar los términos.
  - Un `BackgroundSync` nuevo corrige las mensualidades existentes al abrir la app; no hay cron.

Detalle de decisiones en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), SQL (PostgreSQL 17 de Supabase).

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, next-intl 4, TanStack Query 5, Zustand 5, zod 4, react-hook-form, shadcn/ui, Tailwind, lucide-react, @supabase/supabase-js 2. **Sin dependencias nuevas** (R1).

**Storage**: Supabase Postgres. Nube con free plan en producción; local con Docker para pruebas. Migración nueva `supabase/migrations/0010_update_card_terms.sql`, que agrega **solo una función**; sin tablas ni columnas.

**Testing**: Vitest (unitarias y contrato mock/Supabase), pgTAP (`supabase/tests/`) y Playwright (e2e `@live` y demo, EN/ES, a11y con axe).

**Target Platform**: web en Vercel (despliegues personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**:
- Vista previa instantánea al teclear: 3 estados × un cálculo de días inhábiles memorizado por año.
- `/settings/accounts` y `/dashboard` crecen < 3 KB gzip.

**Constraints**:
- Costo cero, sin cron (Principio I).
- Cálculo en el cliente (Principio V).
- Demo sin backend y con toda escritura bloqueada.
- Todo texto visible en diccionarios.
- Migración a la nube solo con aprobación.
- 360 px sin scroll horizontal.

**Scale/Scope**: 1 usuario real, 6 tarjetas y 1 mensualidad MSI pendiente hoy. Unos 8 archivos nuevos y unos 14 tocados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| I. Zero-cost | Ni servicios, ni dependencias, ni cron. El recálculo de arranque corre al abrir la app (`BackgroundSync`). Los datos siguen siendo texto y números, y el CSV no cambia (mismas columnas). ✅ |
| II. TS estricto y stack | Lógica pura y tipada en `src/domain/` (`CardTerms`, `InstallmentDates`), sin `any`. TanStack Query vía `useSnapshotMutation`. UI con shadcn, Tailwind y Lucide. ✅ |
| III. Supabase con RLS | La función es `security invoker`, así que RLS aplica. `grant` solo a `authenticated`. Migración versionada. pgTAP de permisos y reversión. Sin `service_role`. ✅ |
| IV. Demo aislado | El mock rechaza `update` con `DemoReadOnlyError`. `BackgroundSync` no corre en el demo. El seed usa el mismo `dueDateFor`. `check:demo-bundle` en las puertas. ✅ |
| V. Privacidad / cálculo en cliente | Fechas e inhábiles se calculan en el navegador; el servidor solo aplica fechas ya calculadas. Sin llamadas a terceros (se descarta una API de feriados, R1). ✅ |
| VI. i18n y multi-divisa | Llaves nuevas en `settings` EN/ES con paridad probada. Fechas con `formatDate` según el idioma. Sin montos nuevos. ✅ |
| Flujo | Spec → plan → tareas. Lógica financiera con pruebas unitarias, de contrato y pgTAP. Verificación en normal y demo, en EN y ES. ✅ |

**Re-check post-diseño**: sin cambios; ninguna violación. La spec dice "sin cambio de esquema": la migración `0010` solo agrega una función RPC y ninguna estructura de datos, así que es consistente.

## Project Structure

### Documentation (this feature)

```text
specs/007-card-statement-dates/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain.md
│   ├── data-provider.md
│   └── ui-components.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/0010_update_card_terms.sql       # nuevo: update_account_with_installments
└── tests/card-terms.test.sql                   # nuevo (pgTAP)

src/domain/
├── business-days.ts      # nuevo: easterSunday, bankHolidays, isBusinessDay, previousBusinessDay
├── card-terms.ts         # nuevo: CardTerms, dueDateFor, cardTermsFromStatement, statementWarnings,
│                         #        upcomingStatements, latestStatement, rescheduleCardInstallments
├── credit.ts             # usa dueDateFor; reexporta lastCutOffOn
└── installments.ts       # usa dueDateFor; installmentDatesFor

src/data/
├── provider.ts                         # AccountsRepository.update(id, patch, reschedule?)
├── supabase/repos/accounts.ts          # RPC cuando hay reschedule
├── supabase/database.types.ts          # regenerar con pnpm db:types
├── mock/seed.ts                        # dueFor = dueDateFor
└── mock/provider.ts                    # sin cambio funcional (update ya es denyWrite); firma nueva

src/features/settings/accounts/
├── CardTermsFields.tsx    # nuevo
├── schema.ts              # termsMode + fechas del estado
├── AccountForm.tsx        # monta CardTermsFields
└── hooks.ts               # useUpdateAccount calcula reschedule

src/features/receivables/useRescheduleInstallments.ts   # nuevo (BackgroundSync)
src/components/layout/AppShell.tsx                      # monta el hook
src/i18n/messages/{en,es}.json                          # llaves en settings

tests/
├── unit/domain/{business-days,card-terms}.test.ts      # nuevos
├── unit/domain/{credit,credit-timeline,installments}.test.ts   # expectativas ajustadas (R8)
├── unit/features/card-terms-fields.test.tsx            # nuevo
├── unit/features/settings-schemas.test.ts              # modos statement / manual
├── utils/memory-provider.ts                            # update con reschedule
├── contract/data-provider.contract.ts                  # C1–C7
└── e2e/us14-card-statement-dates.spec.ts               # nuevo: @demo + @live; a11y
```

**Structure Decision**: es el proyecto único existente. La lógica pura va en `src/domain/`, el acceso a datos tras `DataProvider` y la UI en `src/features/settings/accounts/`, siguiendo la separación de las specs 001–005.

## Orden de implementación

1. **Base (bloquea todo)**:
   - `business-days.ts` y `card-terms.ts`, con sus pruebas unitarias. Los datos reales de [research.md](research.md) van primero, en rojo.
2. **US2: límite en día hábil (P1)**:
   - `credit.ts`, `installments.ts` y el seed usan `dueDateFor`.
   - Ajustar las pruebas existentes (R8).
   - Revisar el resultado en Gastos y en el demo.

   Va antes que US1 porque es solo dominio y no toca datos.
3. **US1: capturar desde el estado de cuenta (P1)**:
   - Esquema, `CardTermsFields`, `AccountForm` e i18n.
   - Pruebas de esquema y de componente.
4. **US3: reprogramar MSI (P2)**:
   - Migración `0010` y pgTAP en local; `pnpm db:types`.
   - Cambios en `provider.ts`, el repo Supabase, el mock y el MemoryProvider.
   - Contrato C1–C7.
   - `useUpdateAccount` con `reschedule` y `useRescheduleInstallments` en `AppShell`.
5. **Cierre**:
   - e2e `us14` (demo y live) y a11y.
   - Puertas de calidad y `check:demo-bundle`.
   - Aplicar `0010` en la nube **solo con aprobación** (quickstart § 4) y desplegar.
   - Verificar que la mensualidad de Banregio pasa al 4 de diciembre.

Dependencias entre historias:
- US1 y US2 dependen solo de la base.
- US3 depende de la base y de `installmentDatesFor` (US2).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Pruebas y e2e existentes esperan límites en fin de semana | R8: ajustar con comentario. Revisar las e2e que leen fechas del seed del demo. |
| El `BackgroundSync` reescribe fechas en cada carga si el cálculo no converge | `plan` compara con lo guardado y solo propone diferencias. Prueba de idempotencia: aplicar el plan y volver a planear da `null`. |
| Un límite capturado ya recorrido deriva un offset +1 (Nu, 5 oct) | Aviso `dueMayHaveMoved` y vista previa (R4). |
| Offset muy corto + día inhábil hace que el límite caiga en el corte o antes | Invariante 2 del [data-model.md](data-model.md): usar el nominal. Con prueba. |
| La app anterior en producción entre la migración y el despliegue | La función es nueva y la app vieja no la llama; orden migración → despliegue. |
| Inhábiles extraordinarios (p. ej. 1 oct 2030) | Fuera de alcance (Assumptions). La lista vive en un solo módulo y es fácil de ampliar. |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
