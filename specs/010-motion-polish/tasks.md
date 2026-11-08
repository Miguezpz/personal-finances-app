---
description: "Task list for spec 010 — Animaciones y pulido"
---

# Tasks: Animaciones y pulido

**Input**: Design documents from `specs/010-motion-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/motion.md, quickstart.md

**Tests**: los hooks de motion llevan pruebas unitarias; el comportamiento visible, e2e en demo (`motion.spec.ts`, `a11y.spec.ts`). Los e2e `@live` de alta, baja y pulso quedan **omitidos por decisión del usuario**.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Registrar la línea base del First Load (`pnpm build && node scripts/measure-first-load.mjs`) en "Notas" de specs/010-motion-polish/tasks.md

## Phase 2: Foundational

- [X] T002 [P] Agregar en src/app/globals.css: clases de view transition `page-in`/`page-out` (120 ms de salida; 180 ms de entrada con 60 ms de retraso y 4 px), `::view-transition-old(root), ::view-transition-new(root) { animation: none }`, `::view-transition { pointer-events: none }`, las utilidades `animate-row-in` (200 ms), `animate-row-out` (180 ms, `forwards`) y `animate-field-error-in` (150 ms), y en el bloque de movimiento reducido las duraciones de view transition en 0
- [X] T003 [P] Crear src/components/motion/use-flash-on-change.ts (extraído de BucketCard: no destella en el primer render) y src/components/motion/use-new-row-ids.ts (ids presentes en la primera carga con datos → solo destacan los posteriores), con pruebas en tests/unit/motion/{flash-on-change,new-row-ids}.test.tsx
- [X] T004 [P] Crear src/components/motion/use-drag-to-dismiss.ts (pointer events; umbral "80 px o velocidad ≥ 0.5 px/ms"; regreso con `transition: transform var(--duration-base)`; sin regreso animado con movimiento reducido) con pruebas en tests/unit/motion/drag-to-dismiss.test.tsx
- [X] T005 [P] Crear src/components/motion/use-reveal-on-load.ts (MutationObserver + WAAPI 200 ms, opacidad y 4 px, solo nodos agregados en el lote donde desaparece `[aria-busy="true"]`; no hace nada con movimiento reducido)
- [X] T006 [P] Llave i18n `common.dragToClose` EN/ES en src/i18n/messages/{en,es}.json
- [X] T007 Gate rápido y commit + push

## Phase 3: User Story 1 - Navegar y cargar con continuidad (Priority: P2) 🎯 MVP

- [X] T008 [US1] src/app/(app)/template.tsx: `<ViewTransition enter="page-in" exit="page-out" default="none">` en lugar de `animate-content-in`, más `useRevealOnLoad`; template como componente cliente mínimo (el revelado necesita un efecto)
- [X] T009 [US1] e2e en tests/e2e/motion.spec.ts: con movimiento reducido no quedan animaciones (la prueba existente cubre el template nuevo); al recargar Gastos, el contenido que reemplaza al esqueleto tiene una animación WAAPI en curso (sin movimiento reducido), y con privacidad activa ningún monto queda legible durante el revelado (SC-002)

## Phase 4: User Story 2 - Ver qué cambió en las listas (Priority: P2)

- [X] T010 [US2] `pending-deletes`: conjunto `leaving` con `markLeaving`/`clearLeaving`; `useDeferredDelete` marca `leaving`, espera 180 ms (0 con movimiento reducido) y luego oculta; Deshacer limpia ambos (src/store/pending-deletes.ts, src/features/shared/use-deferred-delete.ts); actualizar tests/unit/features/deferred-delete.test.tsx
- [X] T011 [US2] `useUi.flash(id)` / `flashed` (src/store/ui.ts); llamarlo tras editar con éxito en AddExpenseDialog y RegisterIncomeDialog
- [X] T012 [US2] Filas de ExpensesPage, IncomePage (tarjetas) y RecurringPage: `animate-row-in` para ids nuevos (`useNewRowIds`), `animate-row-out` si están en `leaving`, capa de pulso con `key={flashed.at}` cuando `flashed.id` coincide; `data-row-state` para las pruebas

## Phase 5: User Story 3 - Montos y metas (Priority: P3)

- [ ] T013 [P] [US3] BucketCard usa `useFlashOnChange` (sin cambio visible); GoalsPage: `ProgressBar` crece con `scaleX` desde 0 y las tarjetas destellan al cambiar su monto; NetWorthPage: los tiles destellan al cambiar su valor (src/features/{safe-to-spend/BucketCard,goals/GoalsPage,net-worth/NetWorthPage}.tsx)
- [ ] T014 [US3] e2e: la barra de metas tiene `transform` animado desde 0 (sin movimiento reducido) y la gráfica de patrimonio sigue sin animaciones, en tests/e2e/motion.spec.ts

## Phase 6: User Story 4 - Hojas con asa y arrastre (Priority: P3)

- [ ] T015 [US4] `SheetHandle` (asa visual de 44 px de alto, `data-testid="sheet-handle"`, `aria-hidden`) con `useDragToDismiss` en src/components/ui/sheet.tsx (`side="bottom"`) y src/components/ui/dialog.tsx (solo `max-sm`), que cierra con un `Close` oculto
- [ ] T016 [US4] e2e a 390 px: arrastrar el asa de la hoja ＋ 120 px la cierra; 30 px la deja abierta (tests/e2e/motion.spec.ts)

## Phase 7: User Story 5 - Detalles y accesibilidad (Priority: P3)

- [ ] T017 [P] [US5] `FieldError` con `animate-field-error-in` (src/components/ui/field.tsx)
- [ ] T018 [P] [US5] `DropdownMenuItem` `pointer-coarse:min-h-11` + `focus-visible:ring-2 focus-visible:ring-ring`; radio `pointer-coarse:after:-inset-[14px]`; switch `pointer-coarse:after:-inset-y-[13px]` (src/components/ui/{dropdown-menu,radio-group,switch}.tsx)
- [ ] T019 [US5] e2e: el icono ＋ gira con la hoja abierta (`rotate` en el estilo calculado) y el error de validación aparece con su animación (tests/e2e/motion.spec.ts); a 375 px, los elementos del menú "＋ Nuevo"/⋯ y los radios del formulario de ingreso miden ≥ 44 px (FR-012)

## Phase 8: Polish

- [ ] T020 Gate completo: `pnpm typecheck && pnpm lint && pnpm test`, `E2E_MODES=demo pnpm test:e2e`, `pnpm build`, First Load (≤ +20 kB vs T001), build demo + `pnpm check:demo-bundle`
- [ ] T021 e2e `@live` de alta, baja y pulso y revisión visual en el deploy: **omitidos por decisión del usuario**
- [ ] T022 Resumen final en docs/ux-roadmap.md (lo hecho por spec, lo omitido y los bloqueos) y marcar las tareas completadas

## Dependencies & Execution Order

Phase 2 bloquea todo. Cada historia depende solo de Phase 2. T010 → T012 (mismo flujo de borrado).

## Parallel Opportunities

T002–T006; T013, T017 y T018.

## Implementation Strategy

MVP = Phase 2 + US1. Commit + push por fase.

## Notas

- Línea base First Load (T001, 2026-11-07, tras el spec 009): `/` 304.3 kB gzip; `/dashboard` 334.5 kB gzip. Presupuesto: `/dashboard` ≤ 354.5 kB.
