---
description: "Task list for spec 005 — Gastos rápidos (plantillas de 1 toque)"
---

# Tasks: Gastos rápidos (plantillas de 1 toque)

**Input**: Design documents from `specs/005-quick-expenses/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: se incluyen. La constitución exige pruebas automatizadas de la lógica financiera y verificación en normal y demo, EN y ES. Research R10 y `contracts/data-provider.md` (T1–T9) definen qué se prueba.

**Organization**: tareas agrupadas por historia de usuario. Todo va en `main`, sin rama. Requiere Docker y Supabase local (`pnpm db:start`); nunca correr pruebas contra la nube.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia del spec (US1–US3)

---

## Phase 1: Setup

**Purpose**: entorno local y línea base de peso.

- [X] T001 Levantar Supabase local con `pnpm db:start` y `pnpm db:reset`. Medir el peso actual de `/dashboard` con `pnpm build && node scripts/measure-first-load.mjs` y anotarlo como línea base en `specs/005-quick-expenses/quickstart.md` (§ Prerrequisitos), para la meta de < 5 KB gzip extra del plan

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: esquema, tipos de dominio, lógica pura y capa de datos que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [X] T002 Crear `supabase/migrations/0009_expense_templates.sql` según data-model.md:
  - `create table public.expense_templates` con:
    - `id uuid primary key default gen_random_uuid()`
    - `user_id uuid not null default auth.uid() references auth.users (id) on delete cascade`
    - `name text not null check (char_length(name) between 1 and 40)`
    - `amount_cents bigint not null check (amount_cents > 0)`
    - `subcategory_id uuid not null`
    - `payment_account_id uuid`
    - `sort smallint not null default 0 check (sort >= 0)`
    - `archived boolean not null default false`
    - `created_at` / `updated_at timestamptz not null default now()`
    - `unique (user_id, id)`
    - `foreign key (user_id, subcategory_id) references public.subcategories (user_id, id)`
    - `foreign key (user_id, payment_account_id) references public.accounts (user_id, id)`
  - Trigger `before update … execute function public.set_updated_at()`, igual que `trg_recurring_updated` en `0001_schema.sql`.
  - Índices `(user_id, subcategory_id)`, `(user_id, payment_account_id)` y `(user_id, sort) where not archived`.
  - RLS con el patrón de `0005_rls.sql`: `enable` y `force row level security`, `revoke all … from anon, public`, `grant select, insert, update, delete … to authenticated`, y la política `expense_templates_owner` `for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`.
- [X] T003 Pruebas pgTAP. Correr `pnpm db:reset && pnpm db:test`.
  - Crear `supabase/tests/expense-templates.test.sql`:
    - Rechaza `name` vacío y de 41 caracteres.
    - Rechaza `amount_cents = 0`.
    - Rechaza `sort = -1`.
    - Rechaza una `subcategory_id` de otro usuario (FK compuesta).
    - `updated_at` cambia al actualizar.
  - En `supabase/tests/rls.test.sql`, agregar `'expense_templates'` a la lista de tablas y probar que el usuario B no ve ni modifica la plantilla de A.
  - En `supabase/tests/account-deletion.test.sql`, insertar una plantilla y comprobar que se borra con el usuario.
- [X] T004 Regenerar `src/data/supabase/database.types.ts` con `pnpm db:types`
- [X] T005 [P] En `src/domain/types.ts`:
  - Agregar `interface ExpenseTemplate extends Owned { name: string; amount: Cents; subcategoryId: Uuid; paymentAccountId: Uuid | null; sort: number; archived: boolean }`, con los comentarios de data-model.md ("1–40 caracteres; se usa como nota del gasto", "Total por toque … > 0").
  - Agregar `expenseTemplates: readonly ExpenseTemplate[]` a `FinanceSnapshot`.
- [X] T006 [P] Crear `src/domain/quick-expenses.ts` (puro, sin React):
  - `MAX_ACTIVE_TEMPLATES = 12`, `TEMPLATE_NAME_MAX = 40`.
  - `activeTemplates(templates)`: no archivadas, orden `sort` y luego `name`.
  - `canAddTemplate(templates)`: activas < 12.
  - `templateAvailability(template, snapshot)`: `{ usable: false, reason: "subcategoryArchived" }` o `{ usable: true, accountDropped: boolean }`.
  - `templateToExpense(template, snapshot, today, overrides?: { amount?: Cents; spentOn?: IsoDate }): NewEntity<Expense> | null`, con los campos de data-model.md. Usa `bucketOfSubcategory`; muévelo de `src/features/expenses/hooks.ts` a `src/domain/` y reexpórtalo desde `hooks.ts` para no romper imports. Devuelve null si la plantilla no es usable, si `spentOn > today`, si `amount <= 0` o si la subcategoría no tiene bucket.
  - `templateFromExpense(input: { amount; subcategoryId; paymentAccountId; note }, subcategoryName): NewEntity<ExpenseTemplate>` sin `sort`: el nombre es la nota recortada o el nombre de la subcategoría, cortado a 40.
  - `nextSort(templates)`: max(sort de activas) + 1, o 0 si no hay.
  - `reorderIds(ids, id, "up" | "down")`.
- [X] T007 [P] Crear `tests/unit/domain/quick-expenses.test.ts`:
  - Orden y filtrado de `activeTemplates`.
  - Límite de 12 en `canAddTemplate`.
  - `templateToExpense` con:
    - Plantilla normal: `origin: "manual"`, `note` = nombre, `spentOn` = hoy, `bucket` de la categoría, `recurringExpenseId: null`, `occurrenceDate: null`.
    - `overrides` de monto y de fecha.
    - Fecha futura y monto 0, que devuelven null.
    - Subcategoría archivada, que devuelve null.
    - Cuenta archivada: `paymentAccountId: null`.
  - `templateFromExpense` con nota, sin nota y con una nota de 60 caracteres (se corta a 40).
  - `nextSort`.
  - `reorderIds` en los extremos.
- [X] T008 En `src/data/provider.ts`, agregar `ExpenseTemplatesRepository` (`list`, `create`, `update`, `remove` lógico y `reorder(ids)`, según `contracts/data-provider.md`) y `readonly expenseTemplates: ExpenseTemplatesRepository` en `DataProvider`
- [X] T009 Implementar el repo de Supabase:
  - `src/data/supabase/mappers.ts`: `toExpenseTemplate` y `fromExpenseTemplate` (`amount_cents ↔ amount`, `subcategory_id ↔ subcategoryId`, `payment_account_id ↔ paymentAccountId`; sin `user_id`).
  - Crear `src/data/supabase/repos/expense-templates.ts`:
    - `list`: orden `sort, name`, con paginación por `range` como los demás repos.
    - `create` y `update`: `select().single()`.
    - `remove`: `update({ archived: true })`.
    - `reorder`: un `update({ sort: i })` por id, en paralelo.
    - Un id inexistente en `update` o `remove` lanza `ProviderError('NOT_FOUND')`, y un `check` violado lanza `VALIDATION` (confirmar el mapeo `23514` en `mappers.ts`).
  - Registrar el repo y agregar `expenseTemplates` al `loadSnapshot()` en `src/data/supabase/provider.ts`.
- [X] T010 Actualizar el mock:
  - En `src/data/mock/seed.ts`, sembrar una plantilla `{ name: "Transporte", amount: 2400, subcategoryId: subcategoryId("taxonomy.categories.transportGas", "Public transport"), paymentAccountId: null, sort: 0, archived: false }` con id fijo, e incluirla en el snapshot.
  - En `src/data/mock/provider.ts`, agregar `expenseTemplates: { list: () => list(s().expenseTemplates), create/update/remove/reorder: () => denyWrite("expenseTemplates.<método>") }`.
  - Ajustar `src/data/mock/store.ts` si enumera las colecciones.
- [X] T011 Actualizar `tests/utils/memory-provider.ts` para que `expenseTemplates` sea escribible sobre el snapshot mutable (create con id nuevo de servidor, update, remove lógico, reorder). Agregar `expenseTemplates: []` en `tests/utils/fixtures.ts` y en cualquier snapshot de prueba que `pnpm typecheck` marque
- [X] T012 Pruebas de contrato. Correr `pnpm test:contract:local`.
  - Agregar el `strictObject` de `ExpenseTemplate` en `tests/contract/schemas.ts` y validarlo en el caso de `loadSnapshot`.
  - En `tests/contract/data-provider.contract.ts`, agregar T1–T7 dentro del bloque de proveedores con escritura.
  - Agregar T8 (snapshot del demo con 1 plantilla "Transporte", `amount: 2400`, en "Public transport") y T9 (escrituras rechazadas con `DemoReadOnlyError`) en el bloque de solo lectura.
- [X] T013 [P] En `src/domain/csv.ts`, agregar `expense_templates.csv` a `snapshotToCsvBundle` con las columnas `id,name,amount_cents,subcategory_id,payment_account_id,sort,archived`, y actualizar `tests/unit/domain/csv.test.ts`

**Checkpoint**: esquema local, dominio y ambos proveedores con plantillas, y las suites unitaria, pgTAP y de contrato en verde.

---

## Phase 3: User Story 1 - Registrar un gasto repetido con un toque (Priority: P1) 🎯 MVP

**Goal**: un toque en el Dashboard, o arriba del diálogo de nuevo gasto, registra el gasto de la plantilla con fecha de hoy. El disponible baja al instante y el aviso trae Deshacer. El menú "⋯" ofrece "Ayer" y "Registrar con otro monto o fecha".

**Independent Test**: con una plantilla sembrada (memory provider en unit; seed SQL en e2e live), tocarla. El gasto queda con fecha de hoy y nota "Transporte", Needs baja $24 y Deshacer lo restablece (quickstart C, D, E, F1–F4).

### Tests for User Story 1

- [X] T014 [P] [US1] Crear `tests/unit/features/quick-expense.test.tsx` con `renderWithProviders` y `tests/utils/memory-provider.ts`:
  - `apply` agrega el gasto optimista antes de que el create resuelva.
  - Si el create falla, el snapshot vuelve exactamente al previo.
  - Deshacer mientras el create sigue pendiente espera el id real y borra ese id, no el temporal.
  - Dos `apply` seguidos: el Deshacer del segundo deja el primero.
  - `overrides` de monto y fecha llegan al gasto y la plantilla no cambia.
- [X] T015 [P] [US1] Agregar a `tests/unit/features/template-schema.test.ts` (nuevo) los casos de `quickExpenseOverrideSchema`: monto "12" válido; "0", "-1" y "abc" con `invalidAmount`; fecha de mañana con `futureDate`; fecha de hoy válida

### Implementation for User Story 1

- [X] T016 [P] [US1] Agregar a `src/i18n/messages/en.json` y `es.json` el namespace `quickExpenses` con las claves de US1: `title`, `apply` ("Registrar {name}, {amount}"), `added`, `undo`, `undone`, `addFailed`, `moreOptions`, `yesterday`, `customize`, `customTitle`, `amount`, `date`, `futureDate`, `invalidAmount`, `register`, `unavailableSubcategory`, `accountArchived`. Correr `tests/unit/i18n/parity.test.ts`
- [X] T017 [US1] Crear `src/features/expenses/template-schemas.ts` con `quickExpenseOverrideSchema` (monto con `parseMoneyInput` > 0 → `Cents`; fecha `isIsoDate` y `<= today`, con `today` inyectado como parámetro de una fábrica `makeQuickExpenseOverrideSchema(today)`)
- [X] T018 [US1] Crear `src/features/expenses/quick-expense-hooks.ts` con `useQuickExpense()`, según `contracts/ui-components.md`:
  - `apply(template, overrides?)` llama `templateToExpense` con el snapshot y `useToday()`, y luego `useCreateExpense().mutateAsync`.
  - Al crear: `toast.success(t("added", { name }), { duration: 6000, action: { label: t("undo"), onClick } })`. El `onClick` espera la promesa de esa creación y llama `useDeleteExpense().mutate(row.id)`, con `toast(t("undone"))` al terminar.
  - Si falla y `!isNotifiedGlobally(e)`: `toast.error(t("addFailed"))`.
- [X] T019 [US1] Crear `src/features/expenses/QuickExpenseCustomDialog.tsx` (props `{ template, open, onOpenChange }`):
  - Campos: monto, prellenado con `formatCentsAsInput(template.amount)`, y fecha, prellenada con hoy (`max` = hoy).
  - En solo lectura: subcategoría, método de pago y nota.
  - Al guardar: `apply(template, { amount, spentOn })` y cerrar.
  - Usa `Dialog`, `Field`, `Input` y `react-hook-form` con `zodResolver`, igual que `AddExpenseDialog.tsx`.
- [X] T020 [US1] Crear `src/features/expenses/QuickExpenseBar.tsx` (props `{ variant: "dashboard" | "dialog"; onApplied?: () => void }`):
  - Lee `activeTemplates` del snapshot; si el snapshot no ha cargado, no muestra nada.
  - Contenedor `<ul role="list" data-testid="quick-expense-bar">`, horizontal con `overflow-x-auto` y sin desbordar la página.
  - Por plantilla:
    - Un `Button variant="outline"` con `min-h-11` (≥ 44 px), el `CategoryIcon` de la subcategoría, el nombre con `truncate max-w-40`, `<Money amount>`, `aria-label={t("apply", …)}` y `data-testid="quick-expense-{id}"`. Al tocarlo: `apply` y `onApplied?.()`.
    - Al lado, un botón "⋯" (`DropdownMenu`, `aria-label={t("moreOptions", { name })}`) con "Ayer" (`apply(template, { spentOn: addDays(today, -1) })`) y "Registrar con otro monto o fecha" (abre `QuickExpenseCustomDialog`).
  - Si la subcategoría está archivada (`templateAvailability`), el botón queda `disabled` con `title` y texto `sr-only` `unavailableSubcategory`.
  - En `variant="dialog"` sin plantillas no muestra nada. El estado vacío del Dashboard se agrega en US2 (T029).
- [X] T021 [US1] En `src/features/safe-to-spend/Dashboard.tsx`, montar `<QuickExpenseBar variant="dashboard" />` dentro del bloque con datos, antes de la rejilla de `BucketCard`. Si hay animación de entrada (`intro`), respetarla y no moverla bajo reduced motion
- [X] T022 [US1] En `src/features/expenses/AddExpenseDialog.tsx`, solo en modo nuevo (sin `expense`), mostrar `<QuickExpenseBar variant="dialog" onApplied={() => onOpenChange(false)} />` arriba del formulario, seguido de un `Separator`. Verificar que el botón flotante (`fab-add-expense` en `src/components/layout/MobileNav.tsx`) lo muestra en cualquier página
- [X] T023 [US1] Crear `tests/e2e/us13-quick-expenses.spec.ts`.
  - Bloque `@live`, sembrando la plantilla y el ingreso con `userClient` como en `tests/e2e/us4-expenses.spec.ts`:
    - Tocar `quick-expense-{id}` baja Needs $24; Deshacer lo restablece.
    - Dos toques crean dos gastos.
    - "⋯ › Ayer" registra con la fecha de ayer.
    - "⋯ › otro monto" con 12 registra $12 y la plantilla sigue en $24.
    - En viewport de 390 px, en `/goals`: `fab-add-expense` › tocar la plantilla cierra el diálogo y registra el gasto.
    - El diálogo de edición no muestra la fila.
  - Bloque demo: "Transporte $24" visible en el Dashboard; tocarlo muestra el aviso de solo lectura y el disponible no cambia.

**Checkpoint**: US1 completa y verificable sola (quickstart C, D, E, F1–F4).

---

## Phase 4: User Story 2 - Administrar mis gastos rápidos (Priority: P1)

**Goal**: crear, editar, reordenar y borrar plantillas desde Gastos, más el estado vacío del Dashboard.

**Independent Test**: crear "Transporte · $24", editarla a $30, reordenarla y borrarla. Los gastos ya creados no cambian (quickstart A, B, F, G, H, I).

### Tests for User Story 2

- [X] T024 [P] [US2] Agregar a `tests/unit/features/template-schema.test.ts` los casos de `expenseTemplateFormSchema`:
  - Nombre `"  "` con `nameRequired`.
  - Nombre de 41 caracteres con `nameTooLong`.
  - Monto "0" con `invalidAmount`.
  - Subcategoría vacía con `subcategoryRequired`.
  - `paymentAccountId: ""` se convierte en `null`.
  - Salida tipada con `amount: Cents`.
- [X] T025 [P] [US2] Agregar a `tests/unit/features/quick-expense.test.tsx` los casos de los hooks de administración:
  - `useCreateTemplate` optimista con `sort = nextSort`.
  - `useRemoveTemplate` la oculta de `activeTemplates` sin tocar `expenses`.
  - `useReorderTemplates` intercambia `sort`.
  - Si falla, rollback exacto.

### Implementation for User Story 2

- [X] T026 [P] [US2] Agregar a `quickExpenses` en `en.json` y `es.json`: `create`, `createFirst`, `edit`, `delete`, `deleteConfirm`, `moveUp`, `moveDown`, `name`, `subcategory`, `paymentMethod`, `noPaymentMethod`, `limitReached`, `saved`, `saveFailed`, `nameRequired`, `nameTooLong`, `subcategoryRequired`, `empty`. Correr la prueba de paridad
- [X] T027 [US2] Agregar a `src/features/expenses/template-schemas.ts` `expenseTemplateFormSchema` (nombre `trim` 1–40; monto con `parseMoneyInput` > 0; `subcategoryId` requerido; `paymentAccountId` "" → null), siguiendo `src/features/recurring/schemas.ts`. Agregar a `src/features/expenses/quick-expense-hooks.ts`:
  - `useCreateTemplate`, `useUpdateTemplate`, `useRemoveTemplate` y `useReorderTemplates`.
  - Usan `useSnapshotMutation` con `optimistic` y, para create, `created` con `replaceTemp`.
- [X] T028 [US2] Crear `src/features/expenses/QuickExpenseTemplateDialog.tsx` (props `{ open, template, onOpenChange }`):
  - Campos: nombre, monto, subcategoría (`SubcategoryOptions`, solo activas) y método de pago (cuentas activas, con `noPaymentMethod`).
  - Al guardar: create (con `sort: nextSort(...)`) o update; toast `saved` o `saveFailed`, respetando `isNotifiedGlobally`.
- [X] T029 [US2] Crear `src/features/expenses/QuickExpensesSection.tsx` y montarlo en `src/features/expenses/ExpensesPage.tsx` con `id="quick-expenses"`:
  - Lista de activas con nombre, subcategoría, método de pago y `<Money>`.
  - Aviso `accountArchived` cuando la cuenta está archivada.
  - Botones Editar, Subir y Bajar (deshabilitados en los extremos, con `useReorderTemplates` y `reorderIds`).
  - Borrar con un diálogo de confirmación, como el de borrar un gasto en `ExpensesPage.tsx`.
  - Botón "Nuevo gasto rápido", deshabilitado con `limitReached` cuando `!canAddTemplate`.
  - Estado vacío con `EmptyState`.

  En `QuickExpenseBar` `variant="dashboard"` sin plantillas activas, mostrar el enlace `createFirst` a `/expenses#quick-expenses`.
- [X] T030 [US2] Agregar a `tests/e2e/us13-quick-expenses.spec.ts`:
  - `@live`:
    - Crear una plantilla desde Gastos y verla en el Dashboard.
    - Editar el monto a $30: el siguiente toque registra $30 y el gasto anterior sigue en $24.
    - Subir y bajar cambia el orden del Dashboard.
    - Borrar la quita y conserva los gastos.
    - Archivar su subcategoría deja el botón `disabled`.
    - Dashboard sin plantillas: el enlace lleva a `#quick-expenses`.
  - Demo: crear y borrar muestran el aviso de solo lectura.

**Checkpoint**: US1 y US2 funcionan en vivo de punta a punta.

---

## Phase 5: User Story 3 - Guardar un gasto como gasto rápido (Priority: P2)

**Goal**: el diálogo de nuevo gasto puede crear la plantilla junto con el gasto.

**Independent Test**: un nuevo gasto de $24 en Public transport con nota "Transporte" y el switch marcado crea el gasto y la plantilla (quickstart J).

- [X] T031 [P] [US3] Agregar `saveAsTemplate` a `quickExpenses` en `en.json` y `es.json`
- [X] T032 [US3] En `src/features/expenses/AddExpenseDialog.tsx`, solo en modo nuevo:
  - Un `Switch` con `Label` `saveAsTemplate` y `data-testid="save-as-template"`, deshabilitado con `limitReached` cuando `!canAddTemplate`.
  - En el `onSuccess` del gasto, si está marcado, llamar `useCreateTemplate` con `templateFromExpense(values, nombre de la subcategoría)` y `sort: nextSort(...)`.
- [X] T033 [US3] Agregar a `tests/e2e/us13-quick-expenses.spec.ts` (`@live`):
  - Gasto con nota y el switch marcado: aparecen el gasto y la plantilla "Transporte".
  - Sin nota: la plantilla toma el nombre de la subcategoría.
  - El diálogo de edición no muestra el switch.

**Checkpoint**: las tres historias completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Agregar a `tests/e2e/a11y.spec.ts` el Dashboard con la fila de gastos rápidos y el menú "⋯" abierto, la sección de Gastos y `QuickExpenseCustomDialog`, en claro y oscuro (sin violaciones de axe)
- [ ] T035 [P] Agregar a `tests/e2e/mobile.spec.ts` un caso a 360 px con 6 plantillas: la fila se desplaza sola, `document.scrollingElement.scrollWidth <= innerWidth` y cada botón mide ≥ 44 px de alto (SC-005)
- [ ] T036 [P] Agregar a `tests/unit/components/money.test.tsx`, o a una prueba de `QuickExpenseBar`, que en modo privacidad el monto del botón se enmascara y el nombre no (FR-015)
- [ ] T037 Correr las puertas de calidad: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm db:test && pnpm test:contract:local && pnpm test:e2e:local && pnpm check:demo-bundle`. Medir con `pnpm build && node scripts/measure-first-load.mjs`: `/dashboard` < 5 KB gzip sobre la línea base de T001
- [ ] T038 Recorrer los escenarios manuales A–N y F1–F4 de `specs/005-quick-expenses/quickstart.md` en `pnpm dev` (EN y ES, claro y oscuro) y § 3 en `pnpm dev:demo`
- [ ] T039 **Solo con aprobación explícita del usuario**: aplicar `supabase/migrations/0009_expense_templates.sql` al proyecto en la nube `potodtpkgadgsmeuuafx`, revisar los advisors de seguridad (sin tablas sin RLS) y desplegar desde git justo después (quickstart § 4)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las historias. Orden interno:
  - T002 → T003 → T004.
  - T005, T006 y T007 en paralelo con T002–T004.
  - T008 → T009 (necesita T004) y T010 → T011 → T012.
  - T013 después de T005.
- **US1 (Phase 3)**: después de Phase 2.
- **US2 (Phase 4)**: después de Phase 2. Es independiente de US1 en código, pero T029 toca `QuickExpenseBar` (creado en T020), así que va después de T020.
- **US3 (Phase 5)**: después de US2 (usa `useCreateTemplate` de T027) y de T022 (el mismo archivo `AddExpenseDialog.tsx`).
- **Polish (Phase 6)**: después de las historias que se quieran entregar. T039 al final y solo con aprobación.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- US1: T016/T017 → T018 → T019 → T020 → T021/T022 → T023.
- US2: T026/T027 → T028 → T029 → T030.
- US3: T031 → T032 → T033.

## Parallel Opportunities

- Phase 2: T005, T006 y T007 junto con la migración (T002–T004); T013 en paralelo con T009–T012.
- US1: T014, T015 y T016 a la vez; T021 y T022 tocan archivos distintos y pueden ir juntas.
- US2: T024, T025 y T026 a la vez.
- Polish: T034, T035 y T036 a la vez.

### Ejemplo (US1)

```text
Juntas: T014 (prueba de hooks) · T015 (prueba de esquema) · T016 (i18n)
Luego:  T017 → T018 → T019 → T020
Juntas: T021 (Dashboard) · T022 (AddExpenseDialog)
Final:  T023 (e2e)
```

## Implementation Strategy

### MVP

Phase 1 → Phase 2 → US1. Con eso, una plantilla sembrada ya se registra con un toque desde el Dashboard y desde el botón flotante, con Deshacer, "Ayer" y otro monto. Para crear plantillas en vivo hace falta US2, que también es P1, así que conviene entregar las dos juntas.

### Entrega incremental

1. Base + US1 → escenarios C, D, E, F1–F4.
2. US2 → A, B, F, G, H, I.
3. US3 → J.
4. Polish → K, L, M, N; puertas de calidad; con aprobación, la nube (T039). La migración `0009` se aplica una sola vez.
