# Implementation Plan: Pago de tarjeta como checklist y sesión de pago del mes

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-card-paid-checklist/spec.md`

## Summary

Dos cambios:
- El pago de tarjeta deja de ser un movimiento con monto y pasa a ser una **marca por estado de cuenta** ("Ya la pagué"), que se puede desmarcar.
- La app propone una **sesión de pago del mes**: una ventana de 1–3 días, junto a la quincena, en la que se pueden pagar todas las tarjetas.

**Enfoque**:
- **Datos**: tabla nueva `card_statement_marks` (migración `0011`, con RLS y unicidad por corte). Convierte los `card_payments` existentes en marcas. La tabla anterior se conserva, pero la app deja de leerla. Antes de aplicar la migración a la nube, el dueño revisa la conversión con una consulta de solo lectura (R4).
- **Dominio**:
  - `credit.ts` cambia a "pagado hasta el último corte marcado": sin resta de pagos, así que no hay saldo a favor (R2, R3). Gana `statementOf` (el estado `nothing` que tenía al principio se retiró el 2026-11-08; ver Notas de tasks.md).
  - Nuevo `payment-sessions.ts`: agrupación mínima de rangos de pago y ventana junto al día de pago (R5).
  - Nuevo `legacy-card-payments.ts`: la regla de conversión, compartida con el SQL y el seed.
  - `ledger.ts` y `csv.ts` dejan de incluir pagos.
- **UI**:
  - "Ya la pagué" y "Desmarcar" en `CardStatementCard` y en las alertas del Dashboard, con Deshacer de 6 s (R7).
  - `PaymentSessionCard` nuevo en Crédito.
  - Aviso de sesión en el Dashboard desde 7 días antes (R6).
- **Se elimina**: el diálogo de pago, "Pagar tarjeta" en la hoja ＋, el atajo P, las filas de pago en Gastos y el tipo de pago en la Bitácora (R8).
- **Demo**: el seed genera marcas en lugar de pagos y deja un corte pendiente.

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), SQL (PostgreSQL 17 de Supabase).

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, next-intl 4, TanStack Query 5, Zustand 5, sonner, shadcn/ui, Tailwind, lucide-react, @supabase/supabase-js 2. **Sin dependencias nuevas.**

**Storage**: Supabase Postgres. Nube con free plan en producción; local con Docker para pruebas. Migración `supabase/migrations/0011_card_statement_marks.sql`: una tabla nueva y la conversión; no cambia tablas existentes.

**Testing**: Vitest (dominio con fast-check, hooks, componentes, paridad i18n, contrato mock/Supabase), pgTAP y Playwright (demo y `@live`, EN/ES, a11y).

**Target Platform**: web en Vercel (despliegues personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**:
- `paymentSessions` y los resúmenes de tarjeta, O(tarjetas × movimientos), < 5 ms con 5 años de historial.
- Marcar se ve al instante (optimista) y Deshacer/Desmarcar en < 1 s (SC-003).
- El First Load de `/dashboard` crece < 3 KB gzip; desaparece el diálogo de pago, que compensa.

**Constraints**:
- Costo cero y sin cron (Principio I): la sesión se calcula al abrir la app.
- Cálculo en el cliente (Principio V).
- Demo sin backend y con toda escritura bloqueada.
- Todo texto en diccionarios.
- La migración se aplica a la nube solo con aprobación, después de la revisión de FR-032.
- 360 px sin scroll horizontal; áreas táctiles de 44 px.

**Scale/Scope**: 1 usuario real, unas 6 tarjetas. Unos 6 archivos nuevos, unos 35 tocados y 5 eliminados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio                    | Cumplimiento |
| ---------------------------- | ------------ |
| I. Zero-cost                 | Sin servicios, dependencias ni cron. La sesión y los avisos se calculan en el cliente al abrir la app. Los datos son texto y fechas. La exportación incluye las marcas. ✅ |
| II. TS estricto y stack      | Lógica pura y tipada en `src/domain/` (`StatementMark`, `PaymentSession`), sin `any`. Mutaciones con `useSnapshotMutation` (TanStack Query). UI con shadcn, Tailwind y Lucide. ✅ |
| III. Supabase con RLS        | Tabla nueva con RLS, políticas por dueño y FK compuesta. Migración versionada. pgTAP de aislamiento, unicidad y conversión. Sin `service_role`. ✅ |
| IV. Demo aislado             | Mock con `denyWrite` en `create` y `remove`. El seed genera marcas ficticias. `check:demo-bundle` en las puertas. ✅ |
| V. Privacidad / cliente      | Sin llamadas externas. Los montos de la sesión y las tarjetas pasan por `<Money>`, así que el modo privacidad los enmascara. ✅ |
| VI. i18n y multi-divisa      | Llaves nuevas EN/ES con paridad probada. Fechas con `formatDate`. Sin montos nuevos persistidos. ✅ |
| Flujo                        | Spec → clarify → plan → tareas. La lógica financiera (credit, sesiones, conversión) tiene pruebas antes de cerrarse. Verificación en normal y demo, EN y ES. ✅ |

**Re-check post-diseño**: sin violaciones.
- La tabla `card_payments` queda sin uso, pero no se borra. Es una decisión de la spec (Assumptions) para no perder datos reales antes de verificar la conversión; no es complejidad nueva.
- La vista SQL `ledger` sigue incluyendo pagos, pero la app no la usa (R8).

## Project Structure

### Documentation (this feature)

```text
specs/011-card-paid-checklist/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain.md
│   ├── data-provider.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/0011_card_statement_marks.sql        # nuevo: tabla, RLS, conversión
├── queries/preview-card-marks.sql                  # nuevo: revisión previa (solo lectura)
└── tests/card-statement-marks.test.sql             # nuevo pgTAP; account-deletion/rls se extienden

src/domain/
├── types.ts                 # StatementMark; FinanceSnapshot.statementMarks (sin cardPayments)
├── credit.ts                # paidThrough, statementOf, fórmulas R3
├── payment-sessions.ts      # nuevo
├── legacy-card-payments.ts  # nuevo
├── ledger.ts · csv.ts · net-worth.ts · account-kind.ts

src/data/
├── provider.ts              # StatementMarksRepository
├── mock/provider.ts · mock/seed.ts
├── supabase/provider.ts · supabase/mappers.ts · supabase/database.types.ts
├── supabase/repos/statement-marks.ts               # nuevo
└── supabase/repos/card-payments.ts                 # eliminado

src/features/
├── credit/CardStatementCard.tsx · credit/use-card-statements.ts
├── credit/PaymentSessionCard.tsx                   # nuevo
├── credit/use-statement-marks.ts                   # nuevo: marcar/desmarcar + Deshacer
├── credit/CreditPage (página) · safe-to-spend/CardDueAlerts.tsx
├── expenses/ExpensesPage.tsx · expenses/hooks.ts · expenses/schemas.ts
├── expenses/CardPaymentDialog.tsx · LazyCardPaymentDialog.tsx  # eliminados
├── ledger/filters.ts · shared/use-deferred-delete.ts · settings/accounts/AccountForm.tsx

src/components/layout/  create-actions.ts · CreateSheet.tsx · NewMenuContent.tsx ·
                        DialogHost.tsx · use-create-shortcuts.ts
src/store/ui.ts
src/i18n/messages/{en,es}.json

tests/
├── unit/domain/credit.test.ts · card-statement-summary.test.ts · payment-sessions.test.ts (nuevo)
│   · legacy-card-payments.test.ts (nuevo) · ledger/csv/net-worth/installments/account-kind
├── unit/features/statement-marks.test.tsx (nuevo) · components/create-shortcuts.test.tsx
├── unit/data/mock-seed-consistency.test.ts
├── contract/data-provider.contract.ts · contract/schemas.ts
└── e2e/us15-card-paid-checklist.spec.ts (nuevo) · us4-expenses · us9-demo · navigation · mobile · a11y · fixtures
```

**Structure Decision**: un solo proyecto Next.js; se respetan las capas existentes (dominio puro → proveedor de datos → features → componentes).

## Fases de implementación (para `/speckit-tasks`)

1. **Fundacional (bloquea todo)**:
   - Tipos (`StatementMark`, snapshot).
   - `legacy-card-payments.ts`.
   - Fórmulas de `credit.ts`, con pruebas que fallan primero.
   - Repositorio en el proveedor (mock y Supabase).
   - Migración `0011` y pgTAP.
   - Seed del demo.
2. **US1 + US2 (P1)**: hooks de marcar/desmarcar con Deshacer; `CardStatementCard` y alertas del Dashboard; eliminar el diálogo, la hoja ＋, el atajo P y `DialogHost`.
3. **US3 (P2)**: Gastos, Bitácora, CSV y Patrimonio sin pagos con monto.
4. **US4 (P2)**: consulta de revisión, pgTAP de la conversión y documentación de la aplicación a la nube.
5. **US5 (P2)**: `payment-sessions.ts`, `PaymentSessionCard` y el aviso de sesión del Dashboard.
6. **Cierre**: i18n (paridad y limpieza de llaves), e2e demo EN/ES, a11y, build, `check:demo-bundle`, docs (`docs/ux-roadmap.md`, README) y la revisión de la conversión con el dueño antes de aplicar a la nube.

## Complexity Tracking

Sin violaciones que justificar.
