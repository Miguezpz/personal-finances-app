# Implementation Plan: Gastos rápidos (plantillas de 1 toque)

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-quick-expenses/spec.md`

## Summary

El dueño guarda plantillas de gasto (nombre, monto, subcategoría y método de pago opcional) y las registra con un toque desde el Dashboard. Cada toque crea un gasto manual con fecha de hoy. El Safe-to-Spend baja al instante y el aviso de confirmación trae Deshacer.

**Enfoque**:
- Una tabla nueva, `expense_templates`, con RLS (migración `0009`).
- Un `ExpenseTemplatesRepository` en los dos proveedores, cubierto por la suite de contrato.
- Funciones puras en `src/domain/quick-expenses.ts`.
- El toque reutiliza el `useCreateExpense()` optimista que ya existe.
- UI en tres lugares:
  - En el Dashboard, `QuickExpenseBar`, con un menú "⋯" por botón para "Ayer" o "Registrar con otro monto o fecha".
  - Arriba del diálogo de nuevo gasto, la misma fila; ese diálogo es el que abre el botón flotante del celular en cualquier página.
  - En Gastos, `QuickExpensesSection` y su diálogo.

  Además, un switch "Guardar como gasto rápido" en `AddExpenseDialog`.

Detalle de decisiones en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`), SQL (PostgreSQL 17 de Supabase)

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, next-intl 4, TanStack Query 5, Zustand 5, zod 4, sonner 2, shadcn/ui, Tailwind, lucide-react, @supabase/supabase-js 2. **Sin dependencias nuevas.**

**Storage**: Supabase Postgres (nube con free plan en producción; local con Docker para pruebas). Migración nueva `supabase/migrations/0009_expense_templates.sql`.

**Testing**: Vitest (unitarias y contrato mock/Supabase), pgTAP (`supabase/tests/`), Playwright (e2e `@live` y demo, EN/ES, a11y con axe).

**Target Platform**: web en Vercel (despliegues personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**: el disponible cambia en < 100 ms después del toque (SC-002). Esto lo da la escritura optimista sobre el snapshot. La primera carga de `/dashboard` crece < 5 KB gzip.

**Constraints**:
- Costo cero.
- Demo sin backend y con toda escritura bloqueada.
- RLS en la tabla nueva.
- Todo texto visible en diccionarios.
- Migración a la nube solo con aprobación.
- 360 px sin scroll horizontal de la página.

**Scale/Scope**: 1 usuario real, ≤ 12 plantillas activas; ~10 archivos nuevos y ~12 tocados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| I. Zero-cost | Una tabla de texto y números; sin servicios, cron ni dependencias. Las plantillas entran al CSV de respaldo (`expense_templates.csv`). ✅ |
| II. TS estricto y stack | Tipos `ExpenseTemplate` y montos `Cents`; lógica pura en `src/domain/quick-expenses.ts`; TanStack Query vía `useSnapshotMutation`; UI con shadcn, Tailwind y Lucide. ✅ |
| III. Supabase con RLS | `enable` + `force` RLS con política de dueño, `revoke` para `anon`; FKs compuestas `(user_id, …)`; migración versionada; pgTAP de RLS y cascade. ✅ |
| IV. Demo aislado | El mock implementa el repo con `denyWrite`; el seed trae una plantilla ficticia; el toque y la administración muestran el aviso de solo lectura; `check:demo-bundle` en las puertas. ✅ |
| V. Privacidad | Los montos se pintan con `Money` (modo privacidad); cálculo en el cliente; sin llamadas externas. ✅ |
| VI. i18n y multi-divisa | Namespace `quickExpenses` en EN/ES con paridad probada; montos guardados en MXN y convertidos solo al mostrarse. ✅ |
| Flujo | Spec → plan → tareas; pruebas de la lógica (unit + contrato + pgTAP) antes de cerrar; verificación en normal y demo, EN y ES. ✅ |

**Re-check post-diseño**: sin cambios; ninguna violación.

## Project Structure

### Documentation (this feature)

```text
specs/005-quick-expenses/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── data-provider.md
│   └── ui-components.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── migrations/0009_expense_templates.sql          # nuevo
└── tests/
    ├── expense-templates.test.sql                 # nuevo (pgTAP)
    ├── rls.test.sql                               # + expense_templates
    └── account-deletion.test.sql                  # + cascade de plantillas

src/domain/
├── types.ts                 # ExpenseTemplate; FinanceSnapshot.expenseTemplates
├── quick-expenses.ts        # nuevo: activeTemplates, templateAvailability, templateToExpense,
│                            #        templateFromExpense, reorderIds, canAddTemplate
└── csv.ts                   # expense_templates.csv

src/data/
├── provider.ts                              # ExpenseTemplatesRepository; DataProvider.expenseTemplates
├── supabase/{mappers.ts,database.types.ts}  # regenerar con pnpm db:types
├── supabase/repos/expense-templates.ts      # nuevo
├── supabase/provider.ts                     # repo + loadSnapshot
└── mock/{provider.ts,store.ts,seed.ts}      # repo de solo lectura + plantilla "Transporte $24"

src/features/expenses/
├── quick-expense-hooks.ts            # nuevo: useQuickExpense + hooks de administración
├── template-schemas.ts               # nuevo: expenseTemplateFormSchema
├── QuickExpenseBar.tsx               # nuevo (Dashboard + diálogo de nuevo gasto; menú "⋯")
├── QuickExpenseCustomDialog.tsx      # nuevo (otro monto o fecha)
├── QuickExpensesSection.tsx          # nuevo (Gastos)
├── QuickExpenseTemplateDialog.tsx    # nuevo
├── AddExpenseDialog.tsx              # fila de gastos rápidos + switch "Guardar como gasto rápido"
└── ExpensesPage.tsx                  # monta la sección

src/features/safe-to-spend/Dashboard.tsx      # monta QuickExpenseBar
src/i18n/messages/{en,es}.json                # namespace quickExpenses

tests/
├── unit/domain/quick-expenses.test.ts        # nuevo
├── unit/features/template-schemas.test.ts    # nuevo
├── unit/…                                    # csv, seed, paridad i18n
├── contract/{data-provider.contract.ts,schemas.ts}   # T1–T9
└── e2e/us13-quick-expenses.spec.ts           # nuevo: @live + demo; a11y
```

**Structure Decision**: es el proyecto único existente. La lógica pura va en `src/domain/`, el acceso a datos tras `DataProvider` y la UI en `src/features/expenses/`, siguiendo la separación de las specs 001–004.

## Orden de implementación

1. **Base (bloquea todo)**:
   - Migración `0009` y pgTAP en local, luego `pnpm db:types`.
   - Dominio: `types.ts` y `quick-expenses.ts`, con pruebas unitarias.
   - `provider.ts`, repo de Supabase, mapper, mock (repo + seed) y snapshot.
   - Suite de contrato en verde.
2. **US1 Toque (P1)**:
   - `useQuickExpense` (crear con `overrides` opcionales, y Deshacer).
   - `QuickExpenseBar` en el Dashboard y en `AddExpenseDialog`, en modo nuevo.
   - Menú "⋯" con `QuickExpenseCustomDialog`.
3. **US2 Administración (P1)**: esquema, `QuickExpenseTemplateDialog`, `QuickExpensesSection` (subir, bajar, borrar) y el estado vacío del Dashboard.
4. **US3 Guardar como gasto rápido (P2)**: switch en `AddExpenseDialog` con `templateFromExpense`.
5. **Cierre**:
   - CSV, i18n EN/ES, e2e `us13` (live y demo), a11y.
   - Puertas de calidad y `check:demo-bundle`.
   - Aplicar `0009` en la nube **solo con aprobación** (quickstart § 4).

US1 y US2 dependen de la base. En vivo, US1 necesita una plantilla para probarse a mano; mientras no existe US2, las pruebas la siembran directo. US3 depende de US2 (los hooks de crear plantilla).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Deshacer antes de que el servidor confirme borra una fila temporal | Deshacer espera la promesa de esa creación y borra por id real (research R5) |
| Toques dobles accidentales | Deshacer en cada aviso; los toques válidos múltiples son un requisito (FR-010) |
| Fila de botones rompe el diseño en móvil | Scroll horizontal propio, `truncate` y prueba e2e a 360 px (SC-005) |
| Frontend antiguo en producción entre la migración y el despliegue | La tabla es nueva y la app vieja no la lee; orden migración → despliegue |
| Peso del Dashboard | Sin dependencias; componentes pequeños; medir con `scripts/measure-first-load.mjs` |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
