---
description: "Task list for spec 011 — Pago de tarjeta como checklist y sesión de pago del mes"
---

# Tasks: Pago de tarjeta como checklist y sesión de pago del mes

**Input**: Design documents from `specs/011-card-paid-checklist/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{domain,data-provider,ui}.md, quickstart.md

**Tests**: la constitución exige pruebas para la lógica financiera. Las fórmulas de `credit.ts`, las sesiones y la conversión llevan pruebas unitarias escritas antes de la implementación. La migración lleva pgTAP. El comportamiento visible, e2e en demo EN/ES, más e2e `@live` (se ejecutan solo si hay Docker).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Registrar en "Notas" de specs/011-card-paid-checklist/tasks.md la línea base: conteo de unitarias (`pnpm test`) y First Load de `/dashboard` (`NEXT_PUBLIC_DEMO_MODE=true pnpm build`)

## Phase 2: Foundational (bloquea todas las historias)

- [X] T002 Tipos en src/domain/types.ts: `StatementMark extends Owned { cardAccountId: Uuid; cutOff: IsoDate }`; en `FinanceSnapshot` reemplazar `cardPayments` por `statementMarks: readonly StatementMark[]`; eliminar `CardPayment`. Corregir los usos mínimos para compilar (los que se rehacen en tareas posteriores pueden quedar con TODO temporal sin romper `tsc`)
- [X] T003 [P] Pruebas primero en tests/unit/domain/legacy-card-payments.test.ts:
  - pago el día 12 con corte el 10 → corte del 10;
  - pago el mismo día del corte → corte del mes anterior;
  - corte el 31 → último día de febrero;
  - pago el 1 de enero → corte de diciembre.

  Implementar `markForLegacyPayment(cutOffDay, paidOn)` en src/domain/legacy-card-payments.ts con `lastCutOffOn(cutOffDay, addDays(paidOn, -1))`
- [X] T004 Pruebas primero en tests/unit/domain/credit.test.ts y tests/unit/domain/card-statement-summary.test.ts (reescribir los casos de pagos), cubriendo los invariantes 1–5 de contracts/domain.md (con fast-check para "sin saldo a favor" y "desmarcar regresa al estado previo"):
  - `paidThrough`;
  - corte pagado por marca propia o posterior;
  - estado `nothing`;
  - fórmulas R3 de `payToAvoidInterest` y `totalDebt`;
  - cuotas MSI cubiertas por `cardDueOn ≤ due(L)`, marca cuya fecha ya no coincide con un corte tras cambiar los términos (sigue cubriendo hasta su fecha), `creditTimeline` muestra pagado el corte marcado (FR-017);
  - `markId` del último corte;
  - compra tardía dentro de un corte pagado, que queda cubierta.
- [X] T005 Implementar en src/domain/credit.ts: `CardData` con `statementMarks`, `paidThrough`, `statementOf`, `StatementState` con `"nothing"`, las fórmulas R3 en `cardStatus`, y `cardStatementSummary` con `headline: "next"` cuando el último corte es `paid` o `nothing`. Se quita `payAmount`. `creditTimeline` usa `statementOf` (FR-017). Actualizar el encabezado del módulo
- [X] T006 [P] src/domain/net-worth.ts y src/domain/account-kind.ts: dejar de leer `cardPayments`. El bloqueo de cambio de tipo cuenta marcas o compras MSI en lugar de pagos, y `fromAccountId` deja de existir. Actualizar tests/unit/domain/{net-worth,account-kind,installments}.test.ts
- [X] T007 Proveedor: `StatementMarksRepository { list(); create({ cardAccountId, cutOff }); remove(id) }` en src/data/provider.ts, en lugar de `CardPaymentsRepository`; `DataProvider.statementMarks`
- [X] T008 [P] Mock en src/data/mock/provider.ts: `statementMarks.list` del snapshot; `create` y `remove` → `denyWrite("statementMarks.create" | "statementMarks.remove")`
- [X] T009 [P] Supabase:
  - Crear src/data/supabase/repos/statement-marks.ts: `create` con upsert `onConflict: "user_id,card_account_id,cut_off"`, `ignoreDuplicates`, y relectura si no devuelve fila.
  - Agregar el mapper `toStatementMark` en src/data/supabase/mappers.ts.
  - Cargar `card_statement_marks` en `loadSnapshot` en src/data/supabase/provider.ts.
  - Eliminar src/data/supabase/repos/card-payments.ts.
  - Agregar a mano la tabla `card_statement_marks` en src/data/supabase/database.types.ts (se regenera en T041).
- [X] T010 Migración supabase/migrations/0011_card_statement_marks.sql (data-model §1):
  - Tabla con FK compuesta `(user_id, card_account_id) → accounts (user_id, id) on delete cascade`, `unique (user_id, card_account_id, cut_off)`.
  - RLS con las políticas por dueño, al estilo de 0005; grants `select, insert, delete` a `authenticated`.
  - Conversión de `card_payments` con la regla de `markForLegacyPayment` (`make_date` + `least(cut_off_day, días del mes)`), con `on conflict do nothing`.
  - Sin tocar `card_payments` ni la vista `ledger`.
- [X] T011 [P] pgTAP supabase/tests/card-statement-marks.test.sql:
  - aislamiento entre usuarios (ver, insertar sobre tarjeta ajena, borrar);
  - unicidad por corte;
  - casos de conversión de T003 y dos pagos sobre un mismo corte que dejan una marca.

  Extender supabase/tests/account-deletion.test.sql y supabase/tests/rls.test.sql con la tabla nueva
- [X] T012 [P] Consulta de revisión supabase/queries/preview-card-marks.sql: solo `select`, con la misma expresión de corte que T010, que devuelva tarjeta (nombre), `paid_on`, `amount_cents` y el corte que quedaría marcado, ordenada por tarjeta y fecha
- [X] T013 Seed del demo en src/data/mock/seed.ts:
  - Reemplazar la generación de `cardPayments` por marcas: una por estado de cuenta cuyo `due − 2 ≤ today`.
  - El más reciente posterior queda sin marcar (FR-021).
  - Las deudas de `netWorthSnapshots` del seed usan la fórmula R3 con marcas, sin restar pagos.
  - Actualizar el encabezado y tests/unit/data/mock-seed-consistency.test.ts: las marcas existen, ninguna con `cutOff > today`, y al menos un corte cerrado está pendiente en algún `today`.
- [X] T014 Contrato: reemplazar los casos de `cardPayments` por `statementMarks` en tests/contract/data-provider.contract.ts y tests/contract/schemas.ts, según la tabla de contracts/data-provider.md
- [X] T015 Gate rápido (`pnpm typecheck && pnpm lint && pnpm test`) y commit + push

**Checkpoint**: el dominio y los datos conocen las marcas; la UI todavía puede mostrar "Pagar".

---

## Phase 3: User Story 1 — Palomear que ya pagué el corte (P1) 🎯 MVP

**Goal**: un toque marca el corte como pagado en Crédito, Gastos y el Dashboard.

**Independent Test**: un corte pendiente pasa a "Pagado" con un toque, sin formulario, y la alerta del Dashboard desaparece. En el demo aparece el aviso de solo lectura.

- [X] T016 [US1] Pruebas primero en tests/unit/features/statement-marks.test.tsx:
  - marcar actualiza el snapshot al instante y llama a `provider.statementMarks.create`;
  - un fallo revierte;
  - el demo rechaza sin cambiar nada;
  - el aviso trae "Deshacer" y deshacer borra la marca creada.
- [X] T017 [US1] Crear src/features/credit/use-statement-marks.ts:
  - `useMarkStatementPaid()` y `useUnmarkStatement()` con `useSnapshotMutation` (optimista, `replaceTemp`).
  - `useStatementMarkActions()` envuelve ambos con el aviso de 6 s (`UNDO_TOAST_MS`) y "Deshacer", al estilo de `useQuickExpense`.
  - Deshacer espera la promesa de la escritura y aplica la contraria.
  - Demo y sin conexión con sus avisos habituales.
- [X] T018 [US1] src/features/credit/CardStatementCard.tsx:
  - Reemplazar `PayButton` por `MarkPaidButton`: `data-testid="mark-paid"`, `aria-label` con `credit.markPaidFor`, área táctil de 44 px.
  - Estado `nothing` con su badge (`credit.stateNothing`), sin acción.
  - Sin `openCreate`.
  - Variantes `full` y `compact`.
- [X] T019 [US1] src/features/safe-to-spend/CardDueAlerts.tsx: el botón "Pagar" de cada alerta pasa a "Ya la pagué" (mismo hook); un corte `nothing` no genera alerta
- [X] T020 [US1] Eliminar el pago con monto:
  - src/features/expenses/CardPaymentDialog.tsx, src/features/expenses/LazyCardPaymentDialog.tsx;
  - `useCreateCardPayment`/`useDeleteCardPayment` y el esquema de pago en src/features/expenses/{hooks,schemas}.ts;
  - el kind `card-payment` en src/store/ui.ts y src/components/layout/DialogHost.tsx;
  - la acción en src/components/layout/{create-actions.ts,CreateSheet.tsx,NewMenuContent.tsx};
  - el atajo P en src/components/layout/use-create-shortcuts.ts.

  Actualizar tests/unit/components/create-shortcuts.test.tsx
- [X] T021 [P] [US1] i18n en src/i18n/messages/{en,es}.json:
  - agregar `credit.markPaid`, `markPaidFor`, `marked`, `stateNothing`;
  - borrar las llaves de pago con monto listadas en contracts/ui.md, y que tests/unit/i18n/parity.test.ts siga verde.
- [X] T022 [US1] e2e demo en tests/e2e/us15-card-paid-checklist.spec.ts (EN/ES):
  - Crédito y Gastos muestran "Ya la pagué" y ningún "Pagar";
  - tocarlo muestra el aviso de solo lectura y el estado no cambia;
  - la hoja ＋ y "＋ Nuevo" no tienen "Pagar tarjeta", y la tecla P no abre nada.

  Actualizar tests/e2e/{navigation,mobile,us9-demo,a11y}.spec.ts y tests/e2e/fixtures.ts donde usaban el diálogo de pago
- [X] T023 [US1] Gate y commit + push

---

## Phase 4: User Story 2 — Desmarcar un corte (P1)

**Goal**: deshacer una marca al instante o más tarde.

**Independent Test**: marcar y luego "Deshacer" regresa a pendiente; con una marca antigua, "Desmarcar" regresa a pendiente o vencido.

- [X] T024 [US2] src/features/credit/CardStatementCard.tsx: con el último corte `paid` y `markId` propio, botón secundario "Desmarcar" (`data-testid="unmark-paid"`, `aria-label` con `credit.unmarkFor`) que usa `useStatementMarkActions().unmark` con aviso y "Deshacer"
- [X] T025 [P] [US2] i18n `credit.unmark`, `unmarkFor`, `unmarked` EN/ES; pruebas de desmarcar y deshacer-desmarcar en tests/unit/features/statement-marks.test.tsx
- [X] T026 [US2] e2e `@live` en tests/e2e/us15-card-paid-checklist.spec.ts: marcar → Deshacer → pendiente; marcar → esperar el aviso → Desmarcar → pendiente o vencido; el disponible para gastar del Dashboard no cambia (SC-006)
- [X] T027 [US2] Gate y commit + push

---

## Phase 5: User Story 3 — Ver la tarjeta al corriente sin montos inventados (P2)

**Goal**: Gastos, Bitácora, CSV y Patrimonio sin pagos con monto.

**Independent Test**: con un corte marcado y compras nuevas, la deuda total coincide en Crédito y Patrimonio, y no hay filas "Pago de tarjeta".

- [X] T028 [P] [US3] src/features/expenses/ExpensesPage.tsx: quitar las filas `payment-row`, `deleteRow` de pagos, `cardPaymentLabel` y `debtSettlement`; `Row` solo de gastos. src/features/shared/use-deferred-delete.ts: quitar `card-payment`. Actualizar tests/unit/features/deferred-delete.test.tsx y tests/e2e/us4-expenses.spec.ts
- [X] T029 [P] [US3] Bitácora sin pagos:
  - src/domain/ledger.ts: quitar `card_payment` de `LedgerEntryType`, `TYPE_ORDER` y `buildLedger`;
  - src/features/ledger/filters.ts;
  - src/domain/csv.ts: bitácora sin pagos; el respaldo cambia `card_payments.csv` por `card_statement_marks.csv` con `id, card_account_id, cut_off, marked_at`.

  Actualizar tests/unit/domain/{ledger,csv}.test.ts
- [X] T030 [US3] Prueba en tests/unit/domain/net-worth.test.ts: la deuda en Patrimonio = `totalDebt` R3 con marcas; marcar no cambia `computeSafeToSpend` (SC-006)
- [X] T031 [US3] Gate y commit + push

---

## Phase 6: User Story 4 — Historial anterior coherente (P2)

**Goal**: los pagos anteriores se convierten en marcas, con revisión previa.

**Independent Test**: con pagos anteriores (incluido uno con excedente), tras la conversión cada corte cubierto aparece "Pagado" y ningún corte posterior está pagado por excedente.

- [X] T032 [US4] Prueba unitaria de extremo a extremo en tests/unit/domain/legacy-card-payments.test.ts: un historial con pagos (uno excedente) → marcas con `markForLegacyPayment` → `cardStatementSummary` muestra pagados los cortes cubiertos y pendiente el siguiente (SC-004, FR-019)
- [X] T033 [US4] Documentar en specs/011-card-paid-checklist/quickstart.md §4 el procedimiento exacto de revisión y aplicación a la nube (consulta T012 → aprobación del dueño → migración → `pnpm db:types`), sin ejecutarlo contra la nube en esta fase
- [X] T034 [US4] Gate y commit + push

---

## Phase 7: User Story 5 — Sesión de pago del mes (P2)

**Goal**: ventana de 1–3 días para pagar todas las tarjetas, en Crédito y en el Dashboard.

**Independent Test**: con A (corte 10, límite 30) y B (corte 25, límite 14), Crédito muestra la sesión del 11 al 13 de noviembre. Desde 7 días antes, el Dashboard avisa la sesión; dentro de la ventana muestra "Hoy toca pagar tus tarjetas".

- [X] T035 [US5] Pruebas primero en tests/unit/domain/payment-sessions.test.ts con los casos obligatorios de contracts/domain.md:
  - ejemplo de la spec;
  - día de pago dentro del cruce con y sin margen;
  - cruce de 1–2 días;
  - sin cruce → 2 sesiones, y agrupación mínima con 3 tarjetas;
  - tarjeta archivada o sin términos;
  - todas marcadas → `done` y ciclo siguiente;
  - `phase` upcoming/today/past.
- [X] T036 [US5] Implementar src/domain/payment-sessions.ts:
  - `sessionWindow` (FR-027, con `secondPayday` 31 = último día);
  - `paymentSessions` (estado de cuenta vigente por tarjeta, rango `[corte+1, due−1]`, agrupación voraz por fin de rango);
  - `nextPaymentSession` (FR-028/030).
- [X] T037 [US5] UI:
  - Crear src/features/credit/PaymentSessionCard.tsx (contracts/ui.md: `data-testid="payment-session"`, ventana, tarjetas con estado y acción, "Sesión completa" + siguiente) y montarlo arriba en src/features/credit/CreditPage.tsx.
  - Crear el hook `usePaymentSession()` junto a src/features/credit/use-card-statements.ts.
  - Agregar las llaves i18n `credit.session*` EN/ES.
- [X] T038 [US5] src/features/safe-to-spend/CardDueAlerts.tsx:
  - bloque `data-testid="session-alert"` desde 7 días antes del inicio ("Próxima sesión de pago: {ventana}") y dentro de la ventana ("Hoy toca pagar tus tarjetas" con "Ya la pagué" por tarjeta);
  - sin alertas individuales para las tarjetas de esa sesión, salvo las vencidas (FR-029).

  Agregar las llaves `dashboard.sessionUpcoming` y `sessionToday` EN/ES
- [X] T039 [US5] e2e demo en tests/e2e/us15-card-paid-checklist.spec.ts (EN/ES):
  - Crédito muestra `payment-session` con ventana y tarjetas;
  - con el reloj del navegador fijado dentro de la ventana (`page.clock`), el Dashboard muestra `session-alert` en modo "hoy" y no muestra `card-alert` de esas tarjetas.

  Más una prueba de a11y (axe) de Crédito con la sesión
- [X] T040 [US5] Gate y commit + push

---

## Phase 8: Polish & Cross-Cutting

- [X] T041 Verificación completa:
  - `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`;
  - `E2E_MODES=demo pnpm test:e2e`;
  - `NEXT_PUBLIC_DEMO_MODE=true pnpm build && pnpm check:demo-bundle`.

  Si Docker está disponible: `pnpm db:start && pnpm db:reset && pnpm db:test && pnpm test:contract:local && pnpm test:e2e:local` y `pnpm db:types` (regenera src/data/supabase/database.types.ts); si no, registrar en Notas que quedan pendientes
- [X] T042 [P] Revisión visual en el demo (`pnpm dev:demo`) a 390 px y 1440 px, EN y ES, tema neón: Crédito (sesión y tarjetas), Gastos (tarjetas compactas sin filas de pago), Dashboard (aviso de sesión), hoja ＋ sin "Pagar tarjeta"
- [X] T043 [P] Documentación: sección del spec 011 en docs/ux-roadmap.md; README ("Expenses & cards": checklist "Mark as paid" y sesión de pago del mes)
- [X] T044 Revisión con el dueño (FR-032): ejecutar en solo lectura supabase/queries/preview-card-marks.sql contra la nube, mostrar el resultado y **esperar aprobación** antes de aplicar 0011 a la nube (no se aplica sin un "sí" explícito)
- [X] T045 Commit + push final y actualizar Notas con el gate, el First Load y lo pendiente

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T015)**, que bloquea todo. Dentro: T002 antes de todo; T003 y T004 (pruebas) antes de T005; T007 antes de T008 y T009; T010 antes de T011 y T012.
- **US1 (T016–T023)** depende de Foundational. **US2** depende de US1 (mismo componente y hook). **US3**, **US4** y **US5** dependen solo de Foundational y pueden ir en paralelo con US1/US2, aunque US5 reutiliza el botón de US1 (T018), así que conviene hacerla después de US1.
- **Polish (T041–T045)** al final; T044 requiere aprobación del dueño.

## Parallel Opportunities

- Foundational: T003 ∥ T004 (archivos de prueba distintos); T008 ∥ T009; T011 ∥ T012 ∥ T013.
- US3: T028 ∥ T029.
- Polish: T042 ∥ T043.

## Implementation Strategy

1. **MVP = Foundational + US1 + US2**: el checklist funciona y se puede deshacer; los pagos con monto desaparecen de la UI.
2. **US3 + US4**: consistencia de vistas y del historial.
3. **US5**: sesión de pago del mes.
4. **Polish**: verificación completa, documentación y revisión de la conversión con el dueño antes de tocar la nube.

## Notas

- Línea base (T001): unit 715; First Load `/dashboard` 336.2 kB gzip (build demo).
- T009: la vista SQL `ledger_entries` todavía tiene filas `card_payment`; el repositorio de bitácora de Supabase las excluye con `.neq("entry_type", "card_payment")` para coincidir con `buildLedger` (la app no usa ese repo; solo el contrato).
- T010: la FK de la tarjeta no hace cascada (como el resto; las cuentas se archivan). Las marcas se borran con el usuario (`user_id … on delete cascade`).
- T018/T024: `MarkPaidButton` y `UnmarkButton` (src/features/credit/MarkPaidButton.tsx) se comparten entre Crédito, Gastos, el Dashboard y la sesión.
- T041 (gate final): unitarias 748 ✓ · e2e demo 166 ✓ (EN/ES) · build demo ✓ · `check:demo-bundle` ✓ · pgTAP 182 ✓ · contrato mock + Supabase local 45 ✓ · e2e `@live` 69/72.
  - Los 3 fallos `@live` ya existían en c270e99, antes del spec 011: `us13` "reorder, delete and an archived subcategory" (strict mode: dos `template-down` visibles) y `perf-budgets` live-es (SC-010, cambio de idioma de 4.3 s con el servidor de desarrollo). No tocan este spec.
  - Las e2e `@live` del spec (us4, us15) pasan en EN y ES.
  - pgTAP descubrió que `authenticated` tenía UPDATE, TRUNCATE, REFERENCES y TRIGGER en `card_statement_marks` (privilegios por defecto de Supabase). Se corrige con la migración `0012`. `rls.test.sql` ahora cuenta 19 tablas.
- T042: revisión visual en el demo a 1440 px, EN y ES (Crédito, Dashboard, aviso de sesión, aviso de solo lectura). La ventana de Chrome no se pudo redimensionar; a 390 px lo cubren los e2e `mobile.spec` y `us15` (hoja ＋ sin "Pagar tarjeta").
- `0012` está en el repo, pero **no se ha aplicado en la nube**: falta la aprobación del dueño.
- First Load `/dashboard`: 336.2 → 340.5 kB gzip (+4.3), por encima de la meta de 3 kB del plan. El aviso de sesión del Dashboard importa `payment-sessions` y `PaymentSessionCard`. Se acepta: el presupuesto de los specs 008–010 era de +20 kB.
- T037: un corte que todavía no cierra aparece en la sesión con "corta el {fecha}" y sin botón (FR-008). La e2e del demo lo descubrió.
- T039: los nombres accesibles son "Ya la pagué: {tarjeta}" y "Desmarcar: {tarjeta}". axe exige que el texto visible esté dentro del nombre (label-content-name-mismatch).
- T044: la revisión en solo lectura dio 0 pagos que convertir. `0011` se aplicó en la nube con aprobación del dueño, y la versión se renombró a `0011`. **Desviación de orden**: el código llegó a `main` (70cf073) antes que la migración, así que producción no pudo leer la tabla entre ese push y la migración. Se guardó como lección en memoria.

