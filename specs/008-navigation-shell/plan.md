# Implementation Plan: Navegación y consistencia del shell

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-navigation-shell/spec.md`

## Summary

Reorganiza el shell autenticado sin tocar datos:
- Destinos agrupados (barra lateral con secciones y scroll propio, barra móvil `Inicio · Gastos · ＋ · Crédito · Más`, panel "Más" inferior y agrupado). Desaparece el FAB.
- Creación global: hoja ＋ en móvil, "＋ Nuevo" con atajos N/I/P en escritorio y **una sola instancia** de cada diálogo (gasto, ingreso, pago de tarjeta) montada por un `DialogHost` en el shell y controlada por `useUi`.
- Estado de tarjeta unificado: función pura `cardStatementSummary` en `src/domain/credit.ts` + componente `CardStatementCard` usado por Crédito y por el resumen compacto de Gastos.
- Encabezados consistentes (`PageHeader` en Configuración y Reglas, `SettingsHeader` con icono), panel "Apariencia", safe-area, padding inferior solo en móvil y franja de alertas arriba en el Dashboard móvil.

Detalle de decisiones en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`).

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, next-intl 4, TanStack Query 5, Zustand 5, shadcn/ui (Radix), Tailwind 4, lucide-react, framer-motion (solo `NavIndicator`). **Sin dependencias nuevas.**

**Storage**: N/A (sin cambios de esquema ni de datos).

**Testing**: Vitest (unitarias de dominio y de componentes con Testing Library), Playwright (`E2E_MODES=demo`, EN/ES, axe).

**Target Platform**: web en Vercel (personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**: First Load JS de `/dashboard` crece ≤ 20 kB (SC-006). Los tres diálogos y el menú "＋ Nuevo" se cargan en chunks propios (R3).

**Constraints**:
- Reglas de motion de spec 003 (≤ 300 ms, sin animar montos, kill-switch reduced-motion).
- Privacidad: todo monto con `<Money>`.
- Demo sin backend, guardado bloqueado.
- 320 px sin scroll horizontal; 44 px táctil.
- Sin Supabase local: las verificaciones `@live` se omiten por decisión del usuario.

**Scale/Scope**: unos 5 archivos nuevos y unos 20 tocados (más e2e).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
|---|---|
| I. Zero-cost | Sin servicios ni dependencias. ✅ |
| II. TS estricto y stack | Tipos discriminados para los diálogos (`CreateDialog`), lógica de estado de tarjeta pura en `src/domain/credit.ts` con pruebas. Zustand para estado de UI efímero. shadcn, Tailwind, Lucide. ✅ |
| III. Supabase con RLS | No se toca. ✅ |
| IV. Demo aislado | Los diálogos siguen usando `useSnapshotMutation` (DemoReadOnlyError → aviso). `check:demo-bundle` en las puertas. ✅ |
| V. Privacidad / cálculo en cliente | `CardStatementCard` y la franja de alertas usan `<Money>`; el estado se calcula en el cliente. ✅ |
| VI. i18n | Llaves nuevas en `nav`, `create`, `credit` y `dashboard` EN/ES (paridad probada por la prueba de diccionarios existente). ✅ |
| Flujo | Spec → plan → tareas; dominio con unitarias; e2e demo EN/ES. ✅ |

**Re-check post-diseño**: sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/008-navigation-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-shell.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/store/ui.ts                         # CreateDialog (unión discriminada), createSheetOpen, openCreate/closeDialog
src/components/layout/
├── nav-items.ts                        # group, NAV_GROUPS, MOBILE_BAR_ITEMS, isSecondaryRoute
├── AppShell.tsx                        # sidebar agrupada + scroll, safe-area, md:pb-6, "Más" inferior, NewMenu, DialogHost, atajos
├── MobileNav.tsx                       # Inicio · Gastos · ＋ · Crédito · Más; sin FAB ni useFabHidden
├── CreateSheet.tsx                     # nuevo: hoja ＋ (3 acciones + QuickExpenseBar variant="dialog")
├── NewMenu.tsx                         # nuevo: botón "＋ Nuevo" (placeholder) + NewMenuContent lazy
├── NewMenuContent.tsx                  # nuevo: DropdownMenu Radix (chunk propio)
├── DialogHost.tsx                      # nuevo: monta los 3 diálogos lazy según useUi.activeDialog
├── use-create-shortcuts.ts             # nuevo: N/I/P
├── PageHeader.tsx                      # prop `back?` opcional (enlace ‹ Configuración)
└── PreferencesSheet.tsx                # "Apariencia" (icono original SlidersHorizontal)
src/components/ui/responsive-cta.tsx    # se elimina (sus usos pasan a Button default/outline)
src/domain/credit.ts                    # cardStatementSummary (puro)
src/features/credit/
├── CardStatementCard.tsx               # nuevo (variant "full" | "compact")
├── use-card-statements.ts              # nuevo: hook con useFinanceSnapshot + cardStatementSummary
└── CreditPage.tsx                      # usa CardStatementCard; Pagar → openCreate
src/features/expenses/
├── LazyAddExpenseDialog.tsx            # sin cambio de API
├── LazyCardPaymentDialog.tsx           # nuevo
├── CardDebtSummary.tsx                 # resumen compacto con enlace a Crédito (usa use-card-statements)
└── ExpensesPage.tsx                    # sin CTA de alta ni diálogos propios; editar → openCreate({kind:"expense", expense})
src/features/income/
├── LazyRegisterIncomeDialog.tsx        # nuevo
└── IncomePage.tsx                      # sin botón "Registrar ingreso"; editar → openCreate
src/features/safe-to-spend/Dashboard.tsx        # sin CTA ni diálogo; DashboardAlertStrip móvil arriba
src/features/safe-to-spend/DashboardAlertStrip.tsx  # nuevo
src/features/settings/{SettingsIndex,SettingsHeader,settings-sections}.tsx  # PageHeader + iconos compartidos
src/features/settings/rules/RulesSettings.tsx   # SettingsHeader
src/features/{goals,receivables}/*Page.tsx      # ResponsiveCtaButton → Button default
src/i18n/messages/{en,es}.json

tests/
├── unit/domain/card-statement-summary.test.ts  # nuevo
├── unit/components/nav-items.test.ts           # nuevo (grupos, isSecondaryRoute)
├── unit/components/create-shortcuts.test.tsx   # nuevo
├── e2e/fixtures.ts                             # helpers openCreate(page, kind) (móvil y escritorio)
├── e2e/navigation.spec.ts                      # nuevo: US1/US2/US4 (demo)
├── e2e/mobile.spec.ts, a11y.spec.ts, us4-expenses.spec.ts, us10-credit-goals.spec.ts, us9-*.spec.ts,
│   us2-safe-to-spend.spec.ts, us13-quick-expenses.spec.ts, cold-start.spec.ts, perf-budgets.spec.ts
│                                               # selectores nuevos (sin FAB, "＋ Nuevo", CardStatementCard)
```

**Structure Decision**: proyecto único existente. Lógica pura en `src/domain/`, shell en `src/components/layout/`, UI de feature en `src/features/*`.

## Orden de implementación

1. **Base (bloquea todo)**: `useUi` con `CreateDialog`; `nav-items.ts` con grupos; i18n; `DialogHost` + lazies; `cardStatementSummary` con pruebas.
2. **US1 navegación (P1)**: sidebar agrupada y con scroll; `MobileNav` nuevo; panel "Más" inferior; quitar FAB.
3. **US2 creación global (P1)**: `CreateSheet`, `NewMenu`, atajos, quitar diálogos/CTA duplicados de las páginas.
4. **US3 estado de tarjeta (P1)**: `CardStatementCard` en Crédito y Gastos.
5. **US4 encabezados (P2)** y **US5 shell (P2)**.
6. **Pulido**: e2e, a11y, bundle, docs.

## Complexity Tracking

Sin violaciones de la constitución.
