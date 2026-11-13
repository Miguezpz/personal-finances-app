# Tasks: Usar lo Ahorrado en metas

**Input**: `specs/014-assign-saved-goals/` (plan, spec, research, data-model, contracts/data.md, contracts/domain.md, quickstart)

**Formato**: `- [ ] T### [P] [USn] descripción con ruta`.
- Las pruebas de dominio se escriben primero y deben fallar.
- El contrato y pgTAP necesitan Supabase local (Docker).
- **La migración `0014` se aplica a la nube antes de hacer push del código que la lee, y solo con confirmación del dueño.** Hasta entonces, el código se queda en commits locales.

## Phase 1: Fundacional (bloquea todo)

- [X] T001 Crear `supabase/migrations/0014_assign_saved_goals.sql` según `contracts/data.md` y `data-model.md`:
  - `alter type public.goal_kind add value if not exists 'purchase';`
  - `goals`: `add column target_cents bigint check (target_cents > 0)`, `add column completed_at timestamptz`, `check (due_month is null or extract(day from due_month) = 1)`.
  - Buscar en el Postgres local (`select conname from pg_constraint where conrelid = 'public.goals'::regclass and contype = 'c'`) el nombre del `check` de forma por tipo de 0001 y reemplazarlo por uno con `kind::text` (R2): `emergency_fund` exige `target_months`; `sinking_fund` exige `annual_cents` y `monthly_cents`; `purchase` exige `target_cents` y `monthly_cents is null`.
  - `check (completed_at is null or (archived_at is not null and kind::text = 'purchase'))`.
  - `create table public.goal_saved_moves`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`, `goal_id uuid not null`, `moved_on date not null`, `amount_cents bigint not null check (amount_cents <> 0)`, `created_at timestamptz not null default now()`, `foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade`.
  - Índice `(user_id, goal_id)`. RLS `enable` + `force`, `revoke all … from anon, public`, `grant select, insert … to authenticated`, `revoke update, delete, truncate, references, trigger … from authenticated` (lección de 0012), política de dueño como en 0011.
  - Comentario de cabecera con el porqué del `kind::text` y del monto con signo.
- [X] T002 [P] Crear `supabase/tests/assign-saved-goals.test.sql` (pgTAP, mismo encabezado que `card-statement-marks.test.sql`), con los casos de `contracts/data.md`: tabla con RLS forzado; `authenticated` sin `update`/`delete`; Compra válida se inserta y con `monthly_cents` falla; `completed_at` sin `archived_at` falla y en un Apartado falla; monto `0` falla; movimiento a la meta de otro usuario falla; otro usuario no ve los movimientos; borrar la meta borra sus movimientos.
- [X] T003 `pnpm db:reset && pnpm db:types` para regenerar `src/data/supabase/database.types.ts` (enum con `purchase`, columnas nuevas de `goals`, tabla `goal_saved_moves`). Correr `pnpm db:test`.
- [X] T004 En `src/domain/types.ts`:
  - `GoalKind = "emergency_fund" | "sinking_fund" | "purchase"`.
  - `Goal` gana `target: Cents | null` ("Compra: monto objetivo"), `targetMonth: IsoDate | null` ("Compra: mes objetivo, día 1, informativo") y `completed: boolean` ("Compra: Lo compré; implica archived").
  - `interface SavedMove extends Owned { goalId: Uuid; movedOn: IsoDate; amount: Cents }` con el comentario "+ asignación (Ahorrado → meta), − regreso; ≠ 0".
  - `FinanceSnapshot.savedMoves: readonly SavedMove[]`.
- [X] T005 En `src/data/supabase/mappers.ts`: `toGoal` agrega `target: centsOrNull(r.target_cents)`, `targetMonth: dateOrNull(r.due_month)`, `completed: r.completed_at !== null`; `fromGoal` mapea `target → target_cents`, `targetMonth → due_month`, `completed → completed_at` (con `archivedAt`); nuevo `toSavedMove(r: Row<"goal_saved_moves">)`.
- [X] T006 En `src/data/provider.ts`, `GoalsRepository.list()` devuelve también `savedMoves: SavedMove[]` y nuevo `addSavedMove(input: NewEntity<SavedMove>): Promise<SavedMove>` ("Spec 014: una asignación (+) o un regreso (−)"). Implementar:
  - `src/data/supabase/repos/goals.ts`: `list` lee `goal_saved_moves` con `selectAll` (orden por `id`); `addSavedMove` inserta `{ goal_id, moved_on, amount_cents }` y devuelve `toSavedMove`.
  - `src/data/supabase/provider.ts`: `loadSnapshot` incluye `savedMoves: goalData.savedMoves`.
  - `src/data/mock/provider.ts` y `src/data/mock/store.ts`: `list` y `loadSnapshot` con `savedMoves`; `addSavedMove: () => denyWrite("goals.addSavedMove")`.
  - `tests/utils/memory-provider.ts`: `savedMoves` en memoria y `addSavedMove` que inserta con id nuevo.
- [X] T007 En `src/data/mock/seed.ts`, los `Goal` existentes con `target: null, targetMonth: null, completed: false` y `savedMoves: []` en el snapshot (el ejemplo de Compra va en US6).
- [X] T008 [P] En `src/domain/csv.ts`: `goals.csv` agrega `target_mxn`, `target_month`, `completed`; nuevo `goal_saved_moves.csv` con `id, goal_id, moved_on, amount_mxn` (con signo). Actualizar `tests/unit/domain/csv.test.ts` donde fije encabezados o la lista de archivos.
- [X] T009 [P] Contrato:
  - `tests/contract/schemas.ts`: `Goal` con `target`, `targetMonth`, `completed` y `kind` con `purchase`; nuevo esquema `SavedMove`.
  - `tests/contract/data-provider.contract.ts`: la siembra crea también una Compra y un `addSavedMove` (+) y uno (−); integridad `savedMove.goalId` existe; `goals.list().savedMoves` igual a `snapshot.savedMoves`; en la lista de rechazos del demo, `["goals.addSavedMove", () => p.goals.addSavedMove(...)]`.
- [X] T010 Correr `pnpm typecheck` y corregir los literales de `Goal` y `FinanceSnapshot` en pruebas, fixtures (`tests/utils/fixtures.ts`) y código que pidan los campos nuevos (`target: null, targetMonth: null, completed: false`, `savedMoves: []`).

## Phase 2: US1 + US5 — Asignar lo ahorrado a una meta (P1) 🎯 MVP

US5 (Fondo de emergencia y Apartados) usa el mismo código que US1, así que va en la misma fase.

**Independent test**: con $2,327.90 de total ahorrado y nada asignado, asignar $1,000 desde la tarjeta Ahorrado; "Disponible para asignar" muestra $1,327.90 y la meta sube $1,000. STS y patrimonio iguales.

- [X] T011 [US1] En `tests/unit/domain/goals.test.ts`, nuevo `describe("saved moves (spec 014)")` con los casos de `contracts/domain.md`, que fallan primero:
  - `availableToAssign(232_790, [+100_000])` ⇒ `{ available: 132_790, over: false }`; con un regreso de `−200_000` sube 200,000.
  - Total menor que lo asignado ⇒ `over: true` y `available` negativo (la UI pone el piso).
  - `netFromSaved` con movimientos de dos metas solo cuenta la suya.
  - `emergencyFundProgress` con $10,000 aportados y +$1,000 ⇒ `saved` 1,100,000 centavos y `monthsCovered` lo refleja.
- [X] T012 [US1] En `src/domain/goals.ts`: `netFromSaved`, `availableToAssign` y parámetro opcional `moves: readonly SavedMove[] = []` en `emergencyFundProgress` que suma el neto. Actualizar el comentario de cabecera. T011 debe pasar.
- [X] T013 [P] [US1] En `tests/unit/domain/net-worth.test.ts`: patrimonio igual con y sin una asignación y un regreso (FR-012). En `tests/unit/domain/safe-to-spend.test.ts`: `computeSafeToSpend` igual con un snapshot con y sin `savedMoves` (no los recibe; la prueba lo fija).
- [X] T014 [US1] En `src/features/goals/schemas.ts`, `makeSavedMoveSchema(max: Cents)`: `{ goalId: z.string().min(1, "goalRequired"), amount: z.string() }` → transforma con `parseMoneyInput`; monto `> 0` ("invalidAmount") y `≤ max` ("overMax"). Pruebas en `tests/unit/features/goal-schemas.test.ts` (nuevo): $0, negativo, igual al máximo, máximo + 1 centavo.
- [X] T015 [US1] En `src/features/goals/hooks.ts`: `useGoalData` devuelve también `savedMoves`; nuevo `useAddSavedMove()` con `useSnapshotMutation`, optimista `savedMoves: [...s.savedMoves, { ...input, id: tempId }]` y `created` con `replaceTemp`.
- [X] T016 [US1] Crear `src/features/goals/SavedMoveDialog.tsx` (patrón de `src/features/receivables/CollectionDialog.tsx`):
  - Props `{ open, onOpenChange, mode: "assign" | "return", goal: Goal | null, max: Cents, goals: readonly Goal[] }`.
  - Si `goal` es `null`, `NativeSelect` de metas (`data-testid="saved-move-goal"`) con las activas no cumplidas.
  - Campo monto (`data-testid="saved-move-amount"`), texto del máximo con `<Money>`, error `overMax` con el máximo.
  - Al guardar: `useAddSavedMove` con `movedOn: useToday()`, monto con signo según `mode`; toast de éxito; errores con `isNotifiedGlobally` como en `GoalsPage`.
- [X] T017 [US1] En `src/features/safe-to-spend/SavedCard.tsx`:
  - Recibe además `savedMoves` y `goals`; calcula `availableToAssign(saved.total, savedMoves)`.
  - Fila `saved-available` ("Disponible para asignar") con `<Money cents={max(available, 0)}>`.
  - Si `over`: `Alert` (`data-testid="saved-over"`) "Lo asignado supera lo ahorrado".
  - Botón "Asignar" (`data-testid="saved-assign"`), deshabilitado si no hay metas activas o el disponible es $0; abre `SavedMoveDialog` en modo `assign` sin meta.
- [X] T018 [US1] En `src/features/safe-to-spend/Dashboard.tsx` (o su `useSafeToSpend`), pasar `savedMoves` y `goals` del snapshot a `SavedCard`.
- [X] T019 [US1] En `src/features/goals/GoalsPage.tsx`:
  - Fondo de emergencia: `emergencyFundProgress(..., data.savedMoves)`.
  - Apartado: `saved = savedThisYear + netFromSaved` (R4).
  - Botón "Asignar" (`data-testid="goal-assign"`) en metas activas no cumplidas, solo si `saveSurplus` está encendido (leer `useSafeToSpend().data?.saved`); abre `SavedMoveDialog` con la meta y `max = max(available, 0)`.
- [X] T020 [P] [US1] i18n en `src/i18n/messages/es.json` y `en.json`: `dashboard.savedAvailable` ("Disponible para asignar" / "Available to assign"), `dashboard.savedOver`, `goals.assign` ("Asignar" / "Assign"), título y descripción del diálogo, `goals.maxAvailable`, `goals.goalRequired`, `goals.overMax` (con `{max}`), `goals.assigned` (toast).

## Phase 3: US2 — Meta "Compra" con avance (P1)

**Independent test**: crear "Laptop", $25,000, 2027-03; asignarle $5,000; la tarjeta muestra 20%, "$5,000 de $25,000" y "mar 2027".

- [X] T021 [US2] En `tests/unit/domain/goals.test.ts`, `purchaseProgress`: $25,000 con $5,000 ⇒ `ratio 0.2`; con $30,000 ⇒ `ratio 1` y `saved 3,000,000`; sin movimientos ⇒ 0. Implementar `purchaseProgress` en `src/domain/goals.ts`. Agregar una prueba de que `dueContributions` nunca genera aportaciones de una Compra.
- [X] T022 [US2] En `src/features/goals/schemas.ts`:
  - `GOAL_KINDS` con `purchase`; `DEFAULT_SOURCE_BUCKET.purchase = "investment"` (no se muestra; R2).
  - `goalFormSchema` gana `target: z.string()` y `targetMonth: z.string()`. Para `purchase`: nombre "1–80 caracteres", `target` > 0 ("invalidAmount"), `targetMonth` vacío o `^\d{4}-(0[1-9]|1[0-2])$` ("invalidMonth") → `YYYY-MM-01`; devuelve `monthly: null, annual: null, targetMonths: null`. Los otros tipos devuelven `target: null, targetMonth: null`.
  - Casos en `tests/unit/features/goal-schemas.test.ts`.
- [X] T023 [US2] En `src/features/goals/GoalForm.tsx`: opción "Compra"; para `purchase` mostrar nombre, objetivo y mes (`<Input type="month">`, placeholder `YYYY-MM`) y ocultar bucket y mensualidad. Al editar, precargar `target` con `formatCentsAsInput` y `targetMonth` como `YYYY-MM`. Editar no toca los movimientos (US2-5).
- [X] T024 [P] [US2] En `src/components/icons/domain-icons.ts`, `GOAL_KIND_ICONS.purchase = ShoppingBag`. Revisar `tests/unit/domain/icons.test.ts` si enumera los tipos.
- [X] T025 [US2] En `src/features/goals/GoalsPage.tsx`, sección de Compras (mismo `Card` que los Apartados, `data-kind="purchase"`): `<Money>` del neto, "de $Y" con `<Money>`, `ProgressBar` con `ratio`, mes y año con el formato de fecha del idioma (helpers de `src/i18n/format`) si hay `targetMonth`; botón Asignar de T019.
- [X] T026 [P] [US2] i18n: `goals.kinds.purchase` ("Compra" / "Purchase"), `goals.targetLabel`, `goals.targetMonthLabel`, `goals.targetMonthHint`, `goals.invalidMonth`, `goals.ofTarget` (si no sirve el existente), `goals.targetBy` (con `{month}`).

## Phase 4: US3 — Regresar dinero a Ahorrado (P2)

**Independent test**: con $5,000 asignados a "Laptop", regresar $2,000; la meta queda en $3,000 y el disponible sube $2,000; regresar $4,000 se rechaza.

- [X] T027 [US3] En `src/features/goals/GoalsPage.tsx`, botón "Regresar a Ahorrado" (`data-testid="goal-return"`) en metas no cumplidas con `netFromSaved > 0` (activas o archivadas; con el ajuste encendido o apagado); abre `SavedMoveDialog` en modo `return` con `max = netFromSaved(goal)`.
- [X] T028 [US3] En `SavedMoveDialog`, el modo `return` guarda el monto negativo y usa los textos de regreso. Prueba de componente en `tests/unit/features/saved-move-dialog.test.tsx` (con `renderWithProviders` y `memory-provider`): asignar guarda `+`, regresar guarda `−`, pasar el máximo muestra el error y no guarda.
- [X] T029 [P] [US3] i18n: `goals.returnToSaved` ("Regresar a Ahorrado" / "Return to Saved"), título del diálogo de regreso, `goals.maxReturnable`, `goals.returned` (toast).

## Phase 5: US4 — "Lo compré" (P2)

**Independent test**: marcar "Laptop" como comprada; sale de las activas, aparece archivada con "Cumplida"; el disponible no sube; el patrimonio baja lo neto; restaurar lo revierte.

- [X] T030 [US4] En `tests/unit/domain/net-worth.test.ts`, que falla primero: una Compra con $5,000 netos; con `completed: true` el patrimonio baja exactamente 500,000; con `completed: false` vuelve. Implementar en `src/domain/net-worth.ts`: `assets += (sts.saved?.total ?? 0) − Σ netFromSaved(g) de metas con completed` y actualizar el comentario de cabecera (R5).
- [X] T031 [US4] En `src/features/goals/GoalsPage.tsx`:
  - Botón "Lo compré" (`data-testid="goal-bought"`) en Compras activas: `useUpdateGoal` con `{ archived: true, completed: true }`.
  - Badge "Cumplida" (`data-testid="goal-completed"`) en lugar de "Archivada" cuando `completed`.
  - Restaurar una cumplida manda `{ archived: false, completed: false }`.
  - Sin Asignar ni Regresar en cumplidas.
- [X] T032 [P] [US4] i18n: `goals.bought` ("Lo compré" / "I bought it"), `goals.completedBadge` ("Cumplida" / "Completed"), `goals.markedBought` (toast), aviso corto de no registrar la compra también como gasto (FR-018) en la descripción del botón o el toast.

## Phase 6: US6 — Demo y textos (P3)

**Independent test**: el demo muestra una Compra con avance y "Disponible para asignar" > $0; Asignar, Regresar y Lo compré dan el aviso de solo lectura.

- [X] T033 [US6] En `src/data/mock/seed.ts`, meta Compra "New laptop": `target: cents(2_500_000)`, `targetMonth` = `addMonthsToMonthStart(monthStart(today), 4)`, `sourceBucket: "investment"`, `monthly: null`; `savedMoves` con una asignación de `cents(300_000)` fechada `today`.
- [X] T034 [US6] En `tests/unit/data/mock-seed-consistency.test.ts`: con el seed, `availableToAssign(sts.saved.total, savedMoves).over === false` y `available > 0` (R11). Si falla, bajar el monto del seed.
- [X] T035 [US6] Revisar paridad EN/ES con la prueba existente `tests/unit/i18n/parity.test.ts` y que los textos de US6-3 coincidan exactos.

## Phase 7: Cierre

- [X] T036 Crear `tests/e2e/us18-assign-saved.spec.ts` (patrón de `us17-save-surplus.spec.ts`):
  - **Demo** (EN y ES): `saved-available` visible con monto; Metas muestra una tarjeta `data-kind="purchase"` con `goal-progress-fill`; `saved-assign`, `goal-return` y `goal-bought` muestran el aviso de solo lectura; modo privacidad sin montos legibles en `saved-card` y en la Compra.
  - **Live**: sembrar ajuste encendido y una quincena pasada con sobrante (como US17); crear una Compra; asignar desde la tarjeta Ahorrado y ver el disponible bajar sin recargar; regresar; "Lo compré" y ver "Cumplida"; restaurar.
- [X] T037 Puertas: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`; `pnpm test:contract:local`; `pnpm db:test`; `E2E_MODES=demo pnpm test:e2e`; `pnpm test:e2e:local tests/e2e/us18-assign-saved.spec.ts`.
- [X] T038 [P] En `README.md`, en la fila de Metas: tipo Compra, asignar y regresar lo Ahorrado, "Lo compré".
- [ ] T039 **Nube (con confirmación del dueño)**:
  - Aplicar `0014` con el MCP de Supabase (`apply_migration`) al proyecto `potodtpkgadgsmeuuafx`.
  - Corregir la versión en `supabase_migrations.schema_migrations` al prefijo `0014` y verificar con `list_migrations`.
  - `get_advisors` (security) sin avisos nuevos de `goal_saved_moves`.
  - Solo entonces, push del código y revisar el CI.
- [ ] T040 Verificación manual en la app personal (quickstart, escenarios 1–7).

## Notas de implementación

- T013: la prueba de Safe-to-Spend no se agregó; `computeSafeToSpend` no recibe `savedMoves` (el tipo lo garantiza), y la de patrimonio ya lo calcula sobre un snapshot con movimientos.
- T018: `Dashboard.tsx` no cambió; `SavedCard` lee metas y movimientos del snapshot con `useGoalData`.
- `rls.test.sql` pasa de 19 a 20 tablas.
- La e2e `@live` puede agotar los 30 s en la primera corrida con el servidor de desarrollo en frío (también US17); a la segunda pasa.

## Dependencies

- La Phase 1 bloquea todo. T001 → T002 → T003. T004 → T005, T006, T007, T008, T009 → T010.
- US1: T011 → T012 → T013. T014 → T016. T015 → T016 → T017 → T018. T019 depende de T016. T020 en paralelo.
- US2 depende de T016/T019 solo para el botón Asignar; T021 → T025, T022 → T023.
- US3 depende de US1 (diálogo). US4 depende de US2 (Compra). US6 depende de US2 y US1.
- El cierre va al final. T039 va antes del push del código; los commits de docs se pueden subir antes.

## Parallel examples

- Phase 1: T008 ∥ T009 después de T004–T006.
- US1: T013 ∥ T014 ∥ T020 después de T012.
- US2: T024 ∥ T026 mientras se hacen T021–T023.
- Los JSON de i18n se editan en serie aunque las tareas estén marcadas [P] respecto al código.

## Implementation strategy

- **MVP**: Phases 1 y 2 (asignar desde Ahorrado al Fondo y a los Apartados).
- Después: Compra (US2), Regresar (US3), Lo compré (US4), demo (US6), e2e, puertas, la nube con tu confirmación y el push.
- Mientras `0014` no esté en la nube, **el código se queda en commits locales sin push**.
