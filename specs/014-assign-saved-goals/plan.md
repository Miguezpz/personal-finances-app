# Implementation Plan: Usar lo Ahorrado en metas

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-assign-saved-goals/spec.md`

## Summary

Lo Ahorrado (spec 013) se puede mandar a metas a mano y regresar. Nuevo tipo de meta **Compra** con objetivo, mes opcional, barra y "Lo compré". El Safe-to-Spend no cambia; el patrimonio solo cambia al cumplir una Compra.

**Enfoque**:
- **Datos**: migración `0014`: enum `goal_kind` + `purchase`; `goals.target_cents` y `goals.completed_at` (la fecha reusa `due_month`); tabla nueva `goal_saved_moves` con monto con signo (+ asignar, − regresar) (R1–R3).
- **Dominio**: `netFromSaved`, `availableToAssign`, `purchaseProgress` en `goals.ts`; el Fondo y los Apartados suman el neto; `net-worth.ts` resta el neto de las Compras cumplidas (R4–R5). `safe-to-spend.ts` no se toca (R6).
- **UI**: `SavedMoveDialog` (asignar/regresar), fila "Disponible para asignar" + botón en `SavedCard`, tarjetas Compra y acciones en `GoalsPage`, tipo Compra en `GoalForm` (R9–R10).
- **Demo**: Compra "New laptop" con $3,000 asignados; `addSavedMove` bloqueado (R11).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), SQL (PostgreSQL 17 de Supabase).

**Primary Dependencies**: Next.js 16.4, React 19.3, next-intl 4, TanStack Query 5, react-hook-form + zod, shadcn/ui, Lucide. **Sin dependencias nuevas.** No toca APIs de Next.

**Storage**: Supabase Postgres. `supabase/migrations/0014_assign_saved_goals.sql`: una tabla con RLS y privilegios mínimos, dos columnas y un `check` reemplazado en `goals`, un valor de enum.

**Testing**:
- Vitest: dominio con pruebas que fallan primero (`goals`, `net-worth`, STS sin cambio), esquemas, CSV, paridad i18n, seed del demo (disponible > 0).
- Contrato mock + Supabase local.
- pgTAP `assign-saved-goals.test.sql`.
- Playwright `us18-assign-saved.spec.ts`: demo y `@live`, EN y ES.

**Target Platform**: web en Vercel (personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**: sumas O(movimientos); escritura optimista, se ve en < 1 s sin recargar (SC-004).

**Constraints**:
- Costo cero y cálculo en el cliente (Principios I y V).
- Demo con escritura bloqueada; textos en EN/ES.
- La migración se aplica a la nube **solo con confirmación del dueño y antes del push** del código que la lee; luego se corrige la versión (memoria `migration-before-push`).
- `ALTER TYPE … ADD VALUE` en la misma transacción: los `check` comparan `kind::text` (R2).

**Scale/Scope**: 1 usuario real. Unos 4 archivos nuevos y unos 22 tocados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
| --------- | ------------ |
| I. Zero-cost | Una tabla y dos columnas de texto/números. Sin servicios ni cron. ✅ |
| II. TS estricto y stack | Lógica pura en `goals.ts` y `net-worth.ts`, montos `Cents` enteros. Formularios react-hook-form + zod; componentes shadcn. ✅ |
| III. Supabase con RLS | `goal_saved_moves` con RLS forzado por dueño, sin `anon`, solo `select/insert`. FK compuesta al dueño. Migración versionada + pgTAP. ✅ |
| IV. Demo aislado | `addSavedMove` del mock pasa por `denyWrite`; la UI no sabe qué proveedor hay. Seed ficticio. ✅ |
| V. Privacidad / cliente | Disponible, neto y avance se derivan en el cliente. Montos con `<Money>`. ✅ |
| VI. i18n y multi-divisa | Llaves EN/ES con paridad. Se guarda en MXN; se muestra en la divisa elegida. ✅ |
| Flujo | Spec → plan → tareas. Pruebas de dominio antes de cerrar. Verificación normal/demo, EN/ES. Export CSV incluye la tabla nueva. ✅ |

**Re-check post-diseño**: sin violaciones. Un atajo documentado (R8): los topes se validan en el cliente, no en la base.

## Project Structure

### Documentation (this feature)

```text
specs/014-assign-saved-goals/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/data.md · contracts/domain.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/migrations/0014_assign_saved_goals.sql      # nuevo
supabase/tests/assign-saved-goals.test.sql           # nuevo pgTAP

src/domain/
├── types.ts            # GoalKind + purchase; Goal.target/targetMonth/completed; SavedMove; snapshot.savedMoves
├── goals.ts            # netFromSaved, availableToAssign, purchaseProgress; EF suma el neto
├── net-worth.ts        # − neto de Compras cumplidas
└── csv.ts              # goals.csv + columnas; goal_saved_moves.csv

src/data/
├── provider.ts         # GoalsRepository.list + savedMoves; addSavedMove
├── supabase/database.types.ts · mappers.ts · repos/goals.ts · provider.ts
└── mock/provider.ts · seed.ts

src/components/icons/domain-icons.ts                 # GOAL_KIND_ICONS.purchase

src/features/
├── goals/schemas.ts · hooks.ts · GoalForm.tsx · GoalsPage.tsx · SavedMoveDialog.tsx (nuevo)
└── safe-to-spend/SavedCard.tsx · Dashboard.tsx

src/i18n/messages/{en,es}.json

tests/
├── unit/domain/goals.test.ts · net-worth.test.ts · safe-to-spend.test.ts · csv.test.ts
├── unit/features/goal-schemas.test.ts (nuevo o dentro del archivo de esquemas existente)
├── unit/data/seed (disponible del demo > 0)
├── utils/memory-provider.ts · utils/fixtures.ts
├── contract/schemas.ts · contract/data-provider.contract.ts
└── e2e/us18-assign-saved.spec.ts (nuevo; demo + live)
```

**Structure Decision**: un solo proyecto Next.js con las capas que ya existen.

## Fases de implementación (para `/speckit-tasks`)

1. **Fundacional**:
   - Migración `0014` + pgTAP; `db:reset` y `db:types` en local.
   - Tipos, mappers, repo, providers (Supabase, mock, memoria), fixtures y contrato con los campos nuevos y `savedMoves: []`. CSV.
2. **US1 + US5 (P1/P2, mismo código)**: pruebas de dominio que fallan primero → `netFromSaved`, `availableToAssign`, EF/Apartado con neto; patrimonio sin cambio al asignar. `useAddSavedMove`, `SavedMoveDialog` (asignar), `SavedCard` con disponible + aviso + botón, botón Asignar en metas.
3. **US2 (P1)**: tipo Compra en esquema y `GoalForm`; `purchaseProgress`; tarjeta Compra en `GoalsPage`; icono.
4. **US3 (P2)**: modo regresar en el diálogo y botón Regresar.
5. **US4 (P2)**: "Lo compré", badge "Cumplida", restaurar; patrimonio resta el neto (prueba primero).
6. **US6 (P3)**: seed del demo + prueba de disponible > 0; i18n EN/ES.
7. **Cierre**:
   - e2e demo y live.
   - Puertas: `typecheck`, `lint`, `format:check`, `test`, `build`, `test:contract:local`, `db:test`.
   - **Aplicar `0014` a la nube con confirmación del dueño, corregir la versión, luego push.**
   - README.

## Complexity Tracking

Sin violaciones que justificar.
