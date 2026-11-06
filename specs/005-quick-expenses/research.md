# Research: Gastos rápidos (plantillas de 1 toque)

No quedaron `NEEDS CLARIFICATION` en el Technical Context. Las decisiones siguientes resuelven los puntos abiertos de diseño, a partir del código existente.

## R1 · Almacenamiento: tabla nueva `expense_templates`

- **Decision**: migración `supabase/migrations/0009_expense_templates.sql` con una tabla nueva. Columnas:
  - `id`, `user_id` (default `auth.uid()`, `on delete cascade`)
  - `name` (1–40)
  - `amount_cents > 0`
  - `subcategory_id`
  - `payment_account_id` (nulable)
  - `sort smallint`
  - `archived boolean default false`
  - `created_at`, `updated_at`

  Lleva `unique (user_id, id)` y FKs compuestas `(user_id, …)` hacia `subcategories` y `accounts`, igual que `recurring_expenses` en `0001_schema.sql`. También el trigger `set_updated_at` y los índices de FK con el patrón de `0007_fk_indexes.sql`. RLS `enable` + `force` con la política `<tabla>_owner` y los mismos `revoke`/`grant` de `0005_rls.sql`.
- **Rationale**: es configuración del usuario que tiene que persistir entre dispositivos. Las FKs compuestas impiden apuntar a subcategorías o cuentas de otro usuario, aun con RLS (Principio III).
- **Alternatives considered**:
  - Guardar las plantillas en `user_settings` como JSON: no se valida la FK de subcategoría y rompe el modelo relacional.
  - `localStorage`: no sincroniza entre el celular y la computadora, y el demo no podría sembrarlo igual.

## R2 · Sin columna de bucket

- **Decision**: la plantilla no guarda bucket. Al tocarla, el gasto toma el bucket con `bucketOfSubcategory(snapshot, subcategoryId)` (`src/features/expenses/hooks.ts`), igual que un gasto manual.
- **Rationale**: FR-003. Si el dueño mueve la categoría de bucket, la plantilla se ajusta sola.
- **Alternatives considered**: copiar el bucket como hace `recurring_expenses`. Ahí tiene sentido porque los cargos se materializan sin el usuario; aquí el gasto siempre se crea con el snapshot cargado.

## R3 · Borrado lógico

- **Decision**: borrar una plantilla la marca `archived = true` y deja de listarse. El repo expone `remove(id)`, que hace el `update`.
- **Rationale**: cumple el supuesto de la spec y evita perder la fila si más adelante se quiere restaurar. Los gastos no la referencian, así que el borrado nunca afecta el historial (FR-002).
- **Alternatives considered**: `delete` físico. También sería válido, porque no hay FKs que apunten a la plantilla, pero el borrado lógico es más seguro con un costo mínimo.

## R4 · Un toque = `expenses.create` normal

- **Decision**: el toque llama al `useCreateExpense()` que ya existe. Envía `origin: 'manual'`, `spentOn` = `useToday()` (fecha de negocio en la zona del usuario), `note` = nombre de la plantilla, y `recurringExpenseId` / `occurrenceDate` en `null`. Si la cuenta de la plantilla está archivada, el gasto sale con `paymentAccountId: null`.
- **Rationale**: reutiliza la escritura optimista con rollback (`src/data/snapshot-cache.ts`), así que FR-008 y SC-002 salen gratis. También reutiliza la deuda de tarjeta y el CSV. No requiere RPC nueva.
- **Alternatives considered**:
  - Una RPC `apply_template(id)`: más código SQL y un viaje igual de largo.
  - Un `origin` nuevo `'template'`: obligaría a migrar el enum y a cambiar el ledger, y la spec pide que se comporte como un gasto manual.

## R5 · Deshacer

- **Decision**: el hook `useQuickExpense()` llama `mutateAsync` y muestra `toast.success` de sonner con `action: { label: Deshacer }` y `duration: 6000` (FR-009 pide al menos 5 s). Deshacer espera la promesa de esa misma creación y luego llama `useDeleteExpense().mutate(row.id)`, que también es optimista. Si la creación falló, Deshacer no hace nada porque el rollback ya ocurrió.
- **Rationale**: `useSnapshotMutation` no expone el `tempId` al llamador. Esperar el id real evita borrar una fila temporal que el `created` reemplazaría después. Cada toque guarda su propia promesa, así que Deshacer solo afecta su gasto (edge case de toques seguidos).
- **Alternatives considered**: exponer el `tempId` desde `useSnapshotMutation`. Cambia una pieza compartida por un solo caso y abre la carrera entre `created` y el borrado.

## R6 · Orden

- **Decision**: la columna `sort` guarda el orden. La UI de administración usa botones "subir" y "bajar" (accesibles, sin dependencia de arrastrar). El repo tiene `reorder(ids)`, que reescribe `sort` = índice para cada id. Son 12 filas como máximo, en paralelo.
- **Rationale**: no agrega dependencias (Principio I) y funciona con teclado y lector de pantalla.
- **Alternatives considered**: drag-and-drop con una librería nueva; descartado por peso y accesibilidad.

## R7 · Límite de 12 y nombre de 40

- **Decision**: el nombre de 1–40 caracteres lo validan el esquema zod y un `check` en SQL. El límite de 12 plantillas activas se valida en el cliente: el botón "Nuevo" se deshabilita y muestra el motivo.
- **Rationale**: los 12 son una salvaguarda del diseño de la fila del Dashboard, no un invariante de datos (Assumptions de la spec). Un trigger para eso sería complejidad sin beneficio.
- **Alternatives considered**: un trigger SQL que cuente las filas activas.

## R8 · Dónde vive la UI

- **Decision**:
  - **Dashboard**: `QuickExpenseBar` entre el `PageHeader` y las tarjetas de bucket. Es una fila de botones con scroll horizontal propio (`overflow-x-auto`, sin scroll de página) y botones de 44 px de alto como mínimo. Sin plantillas, muestra un enlace "Crear gasto rápido" a `/expenses#quick-expenses`.
  - **Página de Gastos**: sección "Gastos rápidos" con la lista, el diálogo `QuickExpenseTemplateDialog` (crear/editar), los botones de subir y bajar, y borrar con confirmación.
  - **`AddExpenseDialog`**: en modo nuevo, un `Switch` "Guardar como gasto rápido" (FR-012).
- **Rationale**: el Dashboard es donde se decide gastar. La administración queda junto a los gastos, como la spec supone.

## R9 · Snapshot, CSV y demo

- **Decision**:
  - **Snapshot**: `FinanceSnapshot.expenseTemplates` se carga en `loadSnapshot()` de los dos proveedores.
  - **CSV**: `snapshotToCsvBundle` agrega `expense_templates.csv` (respaldo completo, Principio I).
  - **Demo**: `seed.ts` siembra una plantilla "Transporte" de $24 en la subcategoría "Public transport" de "Transport & Gas" (`subcategoryId("taxonomy.categories.transportGas", "Public transport")`). El repo mock usa `denyWrite` para toda escritura (Principio IV).
- **Rationale**: los cálculos y la UI leen del snapshot único, que es el patrón existente. El CSV ya incluye `recurring_expenses.csv`, y las plantillas son configuración del mismo tipo.

## R10 · Pruebas

- **Decision**:
  - **Unit**: esquema zod; `templateToExpense()` (armado del gasto, bucket, cuenta archivada); orden y filtrado de activas; CSV.
  - **Contrato** (`tests/contract/data-provider.contract.ts`): CRUD, `reorder`, `remove` lógico y snapshot, en mock y en Supabase local.
  - **pgTAP**: agregar `expense_templates` a la lista de `rls.test.sql`, el cascade en `account-deletion.test.sql`, el `check` de nombre y monto, y la FK de subcategoría ajena.
  - **e2e**:
    - `tests/e2e/us13-quick-expenses.spec.ts` en `@live`: crear la plantilla, tocarla, ver que baja el disponible, Deshacer y ver que vuelve.
    - El mismo spec en demo: la plantilla visible y el toque bloqueado con el aviso.
    - a11y con axe en Dashboard y Gastos.
- **Rationale**: la constitución exige pruebas de lógica financiera. El demo no puede probar el toque porque bloquea toda escritura.
