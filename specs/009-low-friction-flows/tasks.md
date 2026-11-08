---
description: "Task list for spec 009 — Flujos y formularios con menos fricción"
---

# Tasks: Flujos y formularios con menos fricción

**Input**: Design documents from `specs/009-low-friction-flows/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-flows.md, quickstart.md

**Tests**: el dominio puro y los hooks llevan pruebas unitarias; los flujos, e2e en demo. Los e2e de escritura (`@live`) se escriben, pero su ejecución queda **omitida por decisión del usuario** (sin Supabase local).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Registrar la línea base del First Load (`pnpm build && node scripts/measure-first-load.mjs`) en "Notas" al final de specs/009-low-friction-flows/tasks.md

---

## Phase 2: Foundational

- [X] T002 [P] Coma decimal en `parseMoneyInput` (src/domain/parse.ts): una sola coma seguida de 1–2 dígitos y sin punto → decimal; "1,250" sigue siendo miles; actualizar el comentario del módulo
- [X] T003 [P] Pruebas de coma decimal y propiedad fast-check (`parse(format(c).replace(".", ","))` = c) en tests/unit/domain/parse.test.ts
- [X] T004 [P] Crear src/domain/recent.ts (`recentSubcategories(expenses, subcategories, n = 6)`: distintas, por `spentOn` desc y luego `createdAt`, sin archivadas) y src/domain/day-groups.ts (`groupByDay(rows, today)` con etiquetas `today`/`yesterday`/`date`), con pruebas en tests/unit/domain/{recent,day-groups}.test.ts
- [X] T005 [P] Crear src/domain/ledger-presets.ts (`presetRange` para `this-period`|`last-period`|`this-month`|`last-month`, `normalizeSearch` sin acentos ni mayúsculas, `matchesSearch`) con pruebas en tests/unit/domain/ledger-presets.test.ts
- [X] T006 [P] Agregar `lastUsed` `{paymentAccountId, subcategoryId, depositAccountId, sourceAccountId}` (Uuid | null, validado en `merge`) y `setLastUsed(patch)` a src/store/preferences.ts, incluido en `partialize`; pruebas en tests/unit/preferences-theme.test.ts o un archivo nuevo tests/unit/store/last-used.test.ts
- [X] T007 [P] Crear src/store/pending-deletes.ts (zustand en memoria: `entries: Map<key, {apply}>`, `version`, `add`, `remove`) y componer los `apply` pendientes en `useFinanceSnapshot` (src/data/useFinanceSnapshot.ts), memoizado por versión y sin envolver el selector si no hay pendientes; agregar `useSnapshotStatus()`
- [X] T008 [P] Opción `onFailure(error, variables)` en `useSnapshotMutation` (src/data/snapshot-cache.ts), llamada en el `onError` de nivel mutación tras el rollback
- [X] T009 [P] Crear src/components/data/PageQueryState.tsx (skeleton / error con `page-error` y `page-retry` / children) y src/components/ui/chip.tsx (toggle con `aria-pressed`, `pointer-coarse:min-h-11`, foco visible)
- [X] T010 [P] Llaves i18n EN/ES en src/i18n/messages/{en,es}.json: `common.undo`, `common.loadError`, `common.saveFailed`, `common.deleted`, chips de fecha (`expenses.dateToday|dateYesterday|dateOther`), `expenses.recent`, `expenses.saveAndAdd`, `expenses.filters.*`, `expenses.clearFilters`, `ledger.presets.*`, `ledger.search`, `dashboard.seeExpenses`, `dashboard.cardDueIn`, `dashboard.cardOverdue`, `create.manageQuick`, `settings.quickExpensesTitle|quickExpensesLinkHint`, `common.today|yesterday`
- [X] T011 Gate rápido (`pnpm typecheck && pnpm lint && pnpm test`) y commit + push

---

## Phase 3: User Story 1 - Registrar más rápido (Priority: P1) 🎯 MVP

**Independent Test**: quickstart A; con escritura real, lo recordado (e2e `@live`, omitido).

- [ ] T012 [US1] Crear src/features/shared/last-used.ts (`useLastUsedDefaults()` validado contra cuentas no archivadas y subcategorías activas)
- [ ] T013 [US1] AddExpenseDialog (src/features/expenses/AddExpenseDialog.tsx): defaults de `lastUsed` (los valores de la página tienen prioridad), `setLastUsed` en `onSuccess`, chips de fecha Hoy/Ayer/Otra con `max={today}` (`date-chip-*`), chips de subcategorías recientes (`recent-subcategory`), "Guardar y agregar otro" + Shift+Enter (solo altas, escritorio, `save-and-add`)
- [ ] T014 [P] [US1] RegisterIncomeDialog: default `depositAccountId` de `lastUsed`, `setLastUsed` en éxito y autofocus del monto al crear (src/features/income/RegisterIncomeDialog.tsx)
- [ ] T015 [P] [US1] CardPaymentDialog: default `fromAccountId` = `sourceAccountId` y `setLastUsed` en éxito (src/features/expenses/CardPaymentDialog.tsx)
- [ ] T016 [P] [US1] RecurringForm: defaults `lastUsed` (cuenta y subcategoría), día de cargo = día de hoy en altas y autofocus del monto (src/features/recurring/RecurringForm.tsx)
- [ ] T017 [P] [US1] GoalForm: el monto mensual sugerido como valor del campo cuando está vacío (src/features/goals/GoalForm.tsx); PreferencesForm: `inputMode="numeric"` en los enteros (src/features/settings/preferences/PreferencesForm.tsx)
- [ ] T018 [US1] e2e demo en tests/e2e/flows.spec.ts: chips de fecha (Otra muestra el input con `max` = hoy), recientes visibles con historial, "250,5" válido sin error de campo, `save-and-add` visible en escritorio y oculto en móvil; e2e `@live` de lo recordado (ejecución omitida por decisión del usuario)

---

## Phase 4: User Story 2 - No perder nada ni borrar por error (Priority: P1)

**Independent Test**: borrar en demo muestra solo lectura sin quitar la fila; deshacer y reintentar con e2e `@live` (omitido) y pruebas unitarias.

- [ ] T019 [US2] Crear src/features/shared/use-deferred-delete.ts según research R3 (demo y sin conexión primero; registro de timers a nivel módulo; `pagehide`; commit con `updateSnapshot` + `provider.<repo>.remove` + rollback y error; Deshacer) con especificaciones por tipo: expense, card-payment, income (usa `withoutIncome`, exportarla de src/features/income/hooks.ts), recurring
- [ ] T020 [P] [US2] Pruebas de `useDeferredDelete` con proveedor en memoria (oculta al instante, Deshacer restaura sin llamar `remove`, commit a 6 s con timers falsos, rollback si falla, demo no oculta) en tests/unit/features/deferred-delete.test.tsx
- [ ] T021 [US2] Usar `useDeferredDelete` y quitar el diálogo de confirmación en src/features/expenses/ExpensesPage.tsx (gastos y pagos), src/features/income/IncomePage.tsx y src/features/recurring/RecurringPage.tsx; "Borrar" dentro de la edición de un gasto (`delete-expense`) en AddExpenseDialog
- [ ] T022 [US2] Crear src/features/shared/retry-toast.ts (`notifySaveFailed`) y ampliar `CreateDialog` en src/store/ui.ts (`draft` en expense/income, kind `receivable`); los diálogos aceptan `draft` como valores iniciales y pasan `onFailure`: AddExpenseDialog, RegisterIncomeDialog y AddReceivableDialog (que se monta lazy en src/components/layout/DialogHost.tsx; ReceivablesPage abre `openCreate({kind:"receivable"})`)
- [ ] T023 [US2] e2e demo: borrar un gasto o un ingreso muestra solo lectura y la fila sigue; sin diálogo de confirmación. e2e `@live`: deshacer y reintentar (ejecución omitida por decisión del usuario) — tests/e2e/flows.spec.ts; ajustar los specs existentes que esperaban el diálogo de confirmación (us9-demo, us4-expenses, us8-settings-ledger si aplica)

---

## Phase 5: User Story 3 - Toda página se recupera de un error (Priority: P1)

- [ ] T024 [US3] Aplicar `PageQueryState` + `useSnapshotStatus` en ExpensesPage, LedgerPage, IncomePage, CreditPage, ReceivablesPage, RecurringPage, GoalsPage y NetWorthPage (src/features/*), conservando sus esqueletos actuales
- [ ] T025 [P] [US3] Prueba de componente de `PageQueryState` (cargando, error con Reintentar → `refetch`, contenido) en tests/unit/components/page-query-state.test.tsx

---

## Phase 6: User Story 4 - Listas cómodas en el teléfono (Priority: P2)

- [ ] T026 [US4] ExpensesPage: agrupar por día con `groupByDay` (`day-group`, `data-label`); en móvil la fila completa es un botón que abre la edición (gasto) o el pago; en escritorio, acciones visibles al hover o al foco
- [ ] T027 [P] [US4] Menú ⋯ (DropdownMenu) para las acciones de las filas de plantillas en src/features/expenses/QuickExpensesSection.tsx y de taxonomía en src/features/settings/taxonomy/TaxonomyEditor.tsx (conservar testids de cada acción como ítems del menú)
- [ ] T028 [P] [US4] ReceivablesPage: cuotas como tarjetas `installment-card` en móvil (`md:hidden`) y tabla solo en escritorio (src/features/receivables/ReceivablesPage.tsx)
- [ ] T029 [US4] e2e demo a 390 px: fila tocable abre la edición con `delete-expense`, grupos por día, cuotas como tarjetas sin overflow; actualizar specs que usaban los iconos de fila o de taxonomía/plantillas (tests/e2e/flows.spec.ts y los afectados)

---

## Phase 7: User Story 5 - Encontrar y filtrar (Priority: P2)

- [ ] T030 [US5] Gastos: selector de quincena en el `PageHeader` (`expenses-period`), que filtra el resumen (`SpendingByMethod` recibe `period`) y la lista; chips de bucket y método + `clear-filters`; estado en la URL (`periodo`, `bucket`, `metodo`) con `useSearchParams`/`router.replace`; `<Suspense>` en src/app/(app)/expenses/page.tsx
- [ ] T031 [US5] Bitácora: filtros en la URL (`desde`, `hasta`, `tipo`, `categoria`, `cuenta`, `terceros`, `q` ≤ 100 caracteres, `preset`) con validación, presets `ledger-preset-*`, búsqueda `ledger-search` (src/features/ledger/{filters.ts,LedgerFilters.tsx,LedgerPage.tsx}); `<Suspense>` en src/app/(app)/ledger/page.tsx
- [ ] T032 [US5] Filas de Bitácora de gasto, ingreso y pago de tarjeta abren la edición (`data-editable`) en src/features/ledger/LedgerTable.tsx
- [ ] T033 [US5] e2e demo: chips de Gastos y URL; preset + búsqueda de Bitácora en la URL y conservados al recargar; fila de Bitácora abre la edición (tests/e2e/flows.spec.ts; ajustar us8-settings-ledger si cambia)

---

## Phase 8: User Story 6 - Dashboard accionable (Priority: P2)

- [ ] T034 [US6] Enlace "Ver gastos" (`bucket-<bucket>-link`) en src/features/safe-to-spend/BucketCard.tsx → `/expenses?bucket=<bucket>`
- [ ] T035 [US6] Crear src/features/safe-to-spend/CardDueAlerts.tsx (tarjetas con último estado no pagado y `daysBetween(today, last.due) ≤ 7`, `card-due-alert`, `<Money>`, Pagar → `openCreate`) y usarla en Dashboard (bloque de escritorio) y como filas en DashboardAlertStrip (móvil)
- [ ] T036 [US6] e2e demo: el enlace del bucket abre Gastos con el chip activo; la alerta de tarjeta aparece cuando el seed la tiene

---

## Phase 9: User Story 7 - Gastos rápidos en Configuración (Priority: P3)

- [ ] T037 [US7] Nueva ruta src/app/(app)/settings/quick-expenses/page.tsx con `SettingsHeader` + `QuickExpensesSection`; entrada en `SETTINGS_SECTIONS` (icono `Zap`); quitar la sección de ExpensesPage; actualizar los enlaces de "crear el primero" (QuickExpenseBar) y `#quick-expenses`
- [ ] T038 [US7] Enlace "Administrar" (`create-manage-quick`) en src/components/layout/CreateSheet.tsx → `/settings/quick-expenses`; agregar la ruta a tests/e2e/app-routes.ts y actualizar us13-quick-expenses (navegación a la nueva ruta)

---

## Phase 10: Polish

- [ ] T039 Gate completo: `pnpm typecheck && pnpm lint && pnpm test`, `E2E_MODES=demo pnpm test:e2e`, `pnpm build`, medir el First Load (≤ +20 kB vs T001), build demo + `pnpm check:demo-bundle`; verificar 44 px táctiles en chips y filas nuevas (FR-032) en tests/e2e/mobile.spec.ts
- [ ] T040 Ejecución de los e2e `@live` (recordar, deshacer, reintentar) y revisión visual en el deploy: **omitidas por decisión del usuario**
- [ ] T041 Marcar las tareas completadas y documentar en "Notas" cualquier bloqueo

## Dependencies & Execution Order

- Phase 2 bloquea todo. US1–US3 (P1) en orden; US4–US7 dependen solo de Phase 2 (US6 usa `useCardStatements` del spec 008).
- Mismo archivo, en secuencia: AddExpenseDialog (T013 → T021 → T022) y ExpensesPage (T021 → T024 → T026 → T030 → T037).

## Parallel Opportunities

- Phase 2: T002–T010. US1: T014–T017. US4: T027 y T028.

## Implementation Strategy

MVP = Phase 2 + US1. Commit + push al cerrar cada fase con el gate rápido.

## Notas

- Línea base First Load (T001, 2026-11-07, tras el spec 008): `/` 301.9 kB gzip; `/dashboard` 331.7 kB gzip. Presupuesto: `/dashboard` ≤ 351.7 kB.
