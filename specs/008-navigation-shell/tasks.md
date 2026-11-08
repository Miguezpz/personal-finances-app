---
description: "Task list for spec 008 — Navegación y consistencia del shell"
---

# Tasks: Navegación y consistencia del shell

**Input**: Design documents from `specs/008-navigation-shell/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-shell.md, quickstart.md

**Tests**: el dominio nuevo (`cardStatementSummary`, `nav-items`, atajos) lleva pruebas unitarias; los flujos, e2e en modo demo. Las verificaciones live/local quedan **omitidas por decisión del usuario** (trabajo solo de UI, sin Supabase local).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario de spec.md (US1–US5)

---

## Phase 1: Setup

- [ ] T001 Registrar la línea base del First Load JS de `/dashboard` y `/expenses` (salida de `pnpm build`) en la sección "Notas" al final de specs/008-navigation-shell/tasks.md

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T002 Retipar el estado de diálogos en src/store/ui.ts: eliminar `DialogId`/`openDialog(id,payload)`; agregar `CreateDialog` (unión discriminada `{kind:"expense"; expense?: Expense|null} | {kind:"income"; income?: Income|null} | {kind:"card-payment"; cardId?: Uuid|null; suggestedAmount?: Cents|null}`), `activeDialog: CreateDialog|null`, `createSheetOpen`, `openCreate(d)` (cierra createSheet, sidebar y preferences antes de abrir), `closeDialog()`, `setCreateSheetOpen(open)`
- [ ] T003 [P] Agregar `group: "main"|"plan"|"debts"|"insights"|"footer"` a `NavItem`, `NAV_GROUPS` (main: dashboard, expenses, income, credit · plan: recurring, goals · debts: receivables · insights: ledger, netWorth · footer: settings), `MOBILE_BAR_ITEMS` (dashboard, expenses, credit), `isSecondaryRoute(pathname)` y `SECONDARY_NAV_GROUPS` (grupos sin los ítems de la barra) en src/components/layout/nav-items.ts; quitar `primary`, `PRIMARY_NAV_ITEMS` y `SECONDARY_NAV_ITEMS` y actualizar sus usos
- [ ] T004 [P] Pruebas de nav-items (orden de grupos, `isSecondaryRoute` para `/goals`, `/settings/rules`, `/expenses` y `/credit`) en tests/unit/components/nav-items.test.ts
- [ ] T005 [P] Agregar llaves i18n EN/ES en src/i18n/messages/{en,es}.json: `nav.groups.{main,plan,debts,insights}`, `nav.create`, `nav.appearance`, `nav.moreTitle`; namespace `create` (`title`, `expense`, `income`, `cardPayment`, `noCards`, `newButton`, `shortcut`); `credit.lastStatement`, `credit.nextStatement`, `credit.statePaid`, `credit.statePending`, `credit.seeInCredit`; `dashboard.alertsLabel`
- [ ] T006 [P] Implementar `cardStatementSummary(card, data, today): CardStatementSummary` en src/domain/credit.ts según data-model.md (`last.state`: `outstanding = 0` → paid; `today > due` → overdue; otro → pending; `next.amount = max(0, cumulative(next.cutOff) − last.outstanding)`; `headline = last.state === "paid" ? "next" : "last"`)
- [ ] T007 [P] Pruebas de `cardStatementSummary` (pagado con compras posteriores = caso Gold Card, pendiente, vencido, pagado en parte, sin movimientos, MSI en el próximo estado, y que el monto `next` coincida con el `card_due` de `creditTimeline`) en tests/unit/domain/card-statement-summary.test.ts
- [ ] T008 [P] Crear src/features/income/LazyRegisterIncomeDialog.tsx y src/features/expenses/LazyCardPaymentDialog.tsx con el patrón de LazyAddExpenseDialog.tsx (lazy + Suspense + `usePreload…`)
- [ ] T009 Crear src/components/layout/DialogHost.tsx según contracts/ui-shell.md (un diálogo a la vez, `key` por entidad, `onOpenChange(false)` → `closeDialog`, precarga en idle) y montarlo una vez en src/components/layout/AppShell.tsx

**Checkpoint**: base lista; gate rápido (`pnpm typecheck && pnpm lint && pnpm test`) y commit.

---

## Phase 3: User Story 1 - Encontrar cualquier sección (Priority: P1) 🎯 MVP

**Goal**: destinos agrupados en escritorio y móvil, "Más" activo en rutas secundarias, sin FAB.

**Independent Test**: quickstart A, B y D.

- [ ] T010 [US1] Barra lateral agrupada en src/components/layout/AppShell.tsx: `NavLinks` recibe grupos, pinta encabezados discretos (`text-xs uppercase text-muted-foreground`), Configuración separada al fondo; `nav` sticky con `max-h-[calc(100dvh-5rem)] overflow-y-auto`
- [ ] T011 [US1] Panel "Más" en src/components/layout/AppShell.tsx: `Sheet side="bottom"` (`rounded-t-2xl`, `max-h-[85dvh] overflow-y-auto`, padding safe-area), título `nav.moreTitle`, `data-testid="more-sheet"`, lista `SECONDARY_NAV_GROUPS` con encabezados; navegar cierra el panel
- [ ] T012 [US1] Reescribir src/components/layout/MobileNav.tsx: Inicio · Gastos · ＋ (`mobile-nav-create`, `variant="cta"` elevado, `aria-haspopup="dialog"`, `aria-expanded`, `aria-label` `nav.create`, alterna `createSheetOpen`) · Crédito · Más (`aria-current="page"` y estilo activo si `isSecondaryRoute`); eliminar el FAB, `useFabHidden` y su diálogo
- [ ] T013 [US1] Actualizar tests/e2e/mobile.spec.ts (barra de 5 elementos, sin `fab-add-expense`, "Más" activo en `/goals`, panel inferior agrupado) y crear tests/e2e/navigation.spec.ts (grupos de la barra lateral, scroll a 1440×600, `aria-current` en todas las APP_ROUTES)

**Checkpoint**: gate rápido + commit.

---

## Phase 4: User Story 2 - Crear desde cualquier pantalla (Priority: P1)

**Goal**: hoja ＋, "＋ Nuevo" con atajos y una sola instancia de cada diálogo.

**Independent Test**: quickstart C, E y F.

- [ ] T014 [US2] Crear src/components/layout/CreateSheet.tsx: `Sheet side="bottom"` controlada por `createSheetOpen`, `data-testid="create-sheet"`, 3 acciones grandes (`create-expense`, `create-income`, `create-card-payment` deshabilitada con `create.noCards` sin tarjetas activas) → `openCreate`; debajo `QuickExpenseBar variant="dialog"` cargada al abrir y que cierra la hoja al registrar; montarla en AppShell.tsx
- [ ] T015 [P] [US2] Crear src/components/layout/NewMenu.tsx (botón placeholder `new-menu`, `variant="cta"`, `hidden md:inline-flex`) y src/components/layout/NewMenuContent.tsx (DropdownMenu Radix cargado con `next/dynamic` `ssr:false`; ítems `new-expense`, `new-income` y `new-card-payment` con `<kbd>` N/I/P); colocarlo en la barra superior de AppShell.tsx
- [ ] T016 [P] [US2] Crear src/components/layout/use-create-shortcuts.ts (N/I/P → `openCreate`; ignora modificadores, `repeat`, `defaultPrevented`, foco editable, paneles de `useUi` abiertos o `[role=dialog][data-state=open]`; P sin tarjetas no hace nada) y montarlo en AppShell.tsx
- [ ] T017 [P] [US2] Pruebas del hook de atajos (abre con N/I/P; ignora en input, con Ctrl/Meta, con diálogo abierto) en tests/unit/components/create-shortcuts.test.tsx
- [ ] T018 [US2] Quitar CTA y diálogos duplicados: src/features/safe-to-spend/Dashboard.tsx (sin botón "Agregar gasto" ni LazyAddExpenseDialog), src/features/expenses/ExpensesPage.tsx (sin "Agregar gasto" ni "Pagar tarjeta" en el encabezado; editar → `openCreate({kind:"expense", expense})`; sin AddExpenseDialog/CardPaymentDialog locales; estado vacío con botón outline → `openCreate({kind:"expense"})`), src/features/income/IncomePage.tsx (sin "Registrar ingreso"; editar → `openCreate({kind:"income", income})`; estado vacío con botón outline)
- [ ] T019 [P] [US2] Sustituir `ResponsiveCtaButton` por `Button` (variant default) en src/features/goals/GoalsPage.tsx y src/features/receivables/ReceivablesPage.tsx; borrar src/components/ui/responsive-cta.tsx
- [ ] T020 [US2] Helper `openCreate(page, kind)` en tests/e2e/fixtures.ts (escritorio: `new-menu` → ítem; móvil: `mobile-nav-create` → acción) y migrar los usos de `add-expense`/`fab-add-expense` en tests/e2e/{us2-safe-to-spend,us4-expenses,us9-demo,us13-quick-expenses,cold-start,perf-budgets,a11y}.spec.ts; agregar a navigation.spec.ts los casos de hoja ＋, menú "＋ Nuevo", atajos y foco en input

**Checkpoint**: gate rápido + commit.

---

## Phase 5: User Story 3 - Un solo estado de tarjeta (Priority: P1)

**Goal**: `CardStatementCard` idéntico en Crédito y Gastos, con Pagar.

**Independent Test**: quickstart G.

- [ ] T021 [US3] Crear src/features/credit/use-card-statements.ts (hook: tarjetas activas + `cardStatementSummary` con `useToday`) y mover allí `useCardStatuses` desde src/features/expenses/CardDebtSummary.tsx
- [ ] T022 [US3] Crear src/features/credit/CardStatementCard.tsx (`variant="full"|"compact"` según contracts/ui-shell.md; `<Money>` para todo monto; Badge "Vencido" con icono; `pay-card` → `openCreate({kind:"card-payment", cardId, suggestedAmount: payAmount})`)
- [ ] T023 [US3] Usar `CardStatementCard variant="full"` en src/features/credit/CreditPage.tsx (eliminar la selección por timeline de las líneas 60-66) y `variant="compact"` en src/features/expenses/CardDebtSummary.tsx con enlace `cards-see-credit` a `/credit`
- [ ] T024 [US3] Actualizar tests/e2e/us10-credit-goals.spec.ts, tests/e2e/us4-expenses.spec.ts y tests/e2e/us9-privacy.spec.ts a la nueva tarjeta; agregar en navigation.spec.ts (demo) que Crédito y Gastos muestran el mismo monto y fecha por tarjeta

**Checkpoint**: gate rápido + commit.

---

## Phase 6: User Story 4 - Encabezados y paneles consistentes (Priority: P2)

**Independent Test**: quickstart H e I.

- [ ] T025 [P] [US4] Agregar prop `back?: {href, label}` a src/components/layout/PageHeader.tsx
- [ ] T026 [US4] Crear src/features/settings/settings-sections.ts (SECTIONS compartido con iconos); `SettingsIndex.tsx` usa PageHeader con `navIcon("/settings")`; `SettingsHeader.tsx` delega en PageHeader con el icono de su sección y `back`; src/features/settings/rules/RulesSettings.tsx usa SettingsHeader
- [ ] T027 [P] [US4] Renombrar el panel en src/components/layout/PreferencesSheet.tsx a `nav.appearance` con icono `Palette` (conservar testids)
- [ ] T028 [US4] e2e: encabezado con icono y "‹ Configuración" en `/settings/rules`; panel "Apariencia" en móvil, en tests/e2e/navigation.spec.ts

---

## Phase 7: User Story 5 - Shell cómodo y alertas a la vista (Priority: P2)

**Independent Test**: quickstart J.

- [ ] T029 [US5] En src/components/layout/AppShell.tsx: header con `pt-[env(safe-area-inset-top)]`, padding lateral con `max(1rem, env(safe-area-inset-left/right))` y altura mínima en lugar de `h-14`; `main` con `pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6`
- [ ] T030 [US5] Crear src/features/safe-to-spend/DashboardAlertStrip.tsx (`md:hidden`; filas compactas tocables: sobregiro → `/expenses`, cobros por vencer → `/receivables` usando el hook expuesto desde src/features/receivables/CollectionAlerts.tsx; nada si no hay alertas) y usarla arriba en Dashboard.tsx; el bloque de alertas completo pasa a `max-md:hidden`
- [ ] T031 [US5] e2e móvil: franja de alertas antes de los buckets cuando hay alertas (demo), en tests/e2e/mobile.spec.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T032 Actualizar tests/e2e/a11y.spec.ts (hoja ＋, panel "Más" y menú "＋ Nuevo" abiertos, en claro, oscuro y móvil)
- [ ] T033 Gate completo: `pnpm typecheck && pnpm lint && pnpm test`, `E2E_MODES=demo pnpm test:e2e`, `pnpm build`, build demo + `pnpm check:demo-bundle`; comparar First Load con T001 (≤ +20 kB)
- [ ] T034 Verificación e2e live (`live-en`, `live-es`) y revisión visual en el deploy: **omitidas por decisión del usuario** (sin Supabase local)
- [ ] T035 Actualizar comentarios de spec 003 obsoletos (FR-019/020/021/027) en los archivos tocados y marcar las tareas completadas

---

## Dependencies & Execution Order

- Phase 2 bloquea todo (T002 → T009; T003, T005, T006 y T008 en paralelo).
- US1 (Phase 3) y US3 (Phase 5) solo dependen de Phase 2. US2 depende de T012 (botón ＋ de la barra). US4 y US5 son independientes.
- Polish al final.

## Parallel Opportunities

- Phase 2: T003, T004, T005, T006, T007 y T008.
- US2: T015, T016, T017 y T019.
- US4: T025 y T027.

## Implementation Strategy

MVP = Phase 2 + US1 (navegación agrupada). Luego US2 y US3 (P1) y después US4 y US5 (P2). Commit + push al cerrar cada fase con el gate rápido en verde.

## Notas

(Línea base del First Load: T001.)
