# Research: Flujos y formularios con menos fricción

## R1 · Dónde vive "lo último usado"
- **Decision**: campo `lastUsed` en el store persistido de preferencias (`pfa:prefs:v1`), validado en `merge` (solo strings uuid o null). `setLastUsed(patch)` se llama en el `onSuccess` del guardado (no al enviar), para no recordar valores rechazados. `useLastUsedDefaults()` filtra contra cuentas no archivadas y subcategorías existentes y no archivadas.
- **Rationale**: ya hay persistencia segura (try/catch, versión, merge defensivo). Solo se guardan identificadores (Principio V).
- **Alternatives**: columna en `user_settings` (cambio de esquema, fuera de alcance).

## R2 · Reintentar tras desmontar el diálogo
- **Decision**: opción `onFailure(error, variables)` en `useSnapshotMutation`, ejecutada en el `onError` de la mutación (las callbacks de nivel mutación corren aunque el componente se desmonte; las de `mutate(vars, {onError})`, no). Los diálogos pasan `onFailure` que llama a `notifySaveFailed({kind, draft, entity})`. Este muestra `toast.error(msg, { action: Reintentar → openCreate({kind, draft, ...}) })`, salvo `isNotifiedGlobally(error)`.
- **Draft**: el valor crudo del formulario (`FormInput`), guardado en una closure del toast; nunca se persiste.
- **Receivables**: `AddReceivableDialog` pasa al `DialogHost` (lazy) como `kind:"receivable"` para que "Reintentar" pueda reabrirlo desde cualquier página.

## R3 · Borrado diferido con deshacer
- **Decision**:
  - `pending-deletes` (zustand, en memoria): `Map<key, {apply: (s) => s}>`.
  - `useFinanceSnapshot` compone `select` con los `apply` pendientes (memoizado con la versión del store); sin pendientes, usa el `select` original, así que no cambia la identidad del selector.
  - `useDeferredDelete()` devuelve `remove({kind, id, label})`:
    1. Si `!canWrite`, llama `notifyDemoReadOnly()` y termina.
    2. Si no hay conexión, llama `notifyOffline()` y termina.
    3. Encola, muestra `toast(label, {duration: 6000, action: Deshacer})` y programa `commit` a 6 s en un registro a nivel módulo (sobrevive a la navegación).
  - `commit`: aplica el optimista real al caché (`updateSnapshot`), quita el pendiente, llama a `provider.<repo>.remove(id)` y, si falla, hace rollback + `toast.error`. Siempre invalida al final.
  - Un listener `pagehide` (registrado una vez) ejecuta todos los commits pendientes (best effort).
  - `Deshacer`: cancela el timer y quita el pendiente (sin llamada al servidor).
- **Rationale**: ocultar en el selector global hace que saldos, Bitácora y export coincidan durante la ventana, y que un refetch no "resucite" la fila.
- **Alternatives**: borrar en el servidor y recrear al deshacer (cambia ids e historial; descartado).

## R4 · Montos con coma decimal
- **Decision**: antes del regex actual, si `/^\$?\s*\d+,\d{1,2}$/` (una sola coma, 1–2 dígitos, sin punto), reemplazar la coma por punto. "1,250" (3 dígitos) sigue siendo miles. Propiedad fast-check: para todo `c` en [0, 10^9], `parse(format(c).replace(".", ","))` = `c` cuando la parte decimal no está vacía.

## R5 · Estados de página
- **Decision**: `useSnapshotStatus()` = `{ isPending, isError, refetch }` de la query del snapshot. `<PageQueryState status skeleton>{children}</PageQueryState>` muestra el esqueleto, la alerta de error (`common.unexpectedError` + `common.loadError` + Reintentar) o el contenido. Las páginas reemplazan `!data ? skeleton : ...`.

## R6 · Formulario de gasto
- **Fecha**: `DateChips` (Hoy/Ayer/Otra) sobre el campo `spentOn` del form. "Otra" revela `<Input type="date" max={today}>`; editar un gasto con fecha distinta de hoy o ayer abre en "Otra".
- **Recientes**: `recentSubcategories(expenses, subcategories, 6)`, ordenado por `spentOn` desc y luego por `createdAt`; distintas y no archivadas.
- **Guardar y otro**: botón secundario `hidden md:inline-flex` + Shift+Enter en el form. Guarda (optimista), toast de éxito y `form.reset({...defaults, paymentAccountId, subcategoryId, spentOn})`, con foco en el monto. Solo en altas.
- **Borrar en edición**: botón destructivo `ghost` en el footer que llama `onOpenChange(false)` y `remove({kind:"expense"})`.

## R7 · Filtros en la URL
- **Gastos**: `?periodo=<PeriodKey>&bucket=needs|wants&metodo=<accountId|none>`. Se lee con `useSearchParams` y se escribe con `router.replace` (sin scroll). La página ya es cliente; se envuelve en `<Suspense>` en `page.tsx` (requisito de Next para `useSearchParams` en rutas estáticas).
- **Bitácora**: `?desde&hasta&tipo&categoria&cuenta&terceros&q&preset`. `LedgerFilterState` se serializa/parsea con validación (valores inválidos → default).
- **Presets**: `this-period`, `last-period` (`periodOf`, `previousPeriod`), `this-month`, `last-month`.
- **Búsqueda**: `normalizeSearch` = minúsculas + NFD sin diacríticos; coincide contra nota y descripción de la entrada.

## R8 · Listas móviles
- **Gastos**: la fila completa es un `<button>` (en móvil) que abre `openCreate({kind:"expense", expense})`. Los pagos de tarjeta abren el diálogo de pago. En escritorio, los iconos se ocultan con `md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100` y en móvil se quitan (`max-md:hidden`).
- **Menús ⋯**: `DropdownMenu` en `QuickExpensesSection` (plantillas) y en `TaxonomyEditor`.
- **Cuotas**: `ReceivablesPage` renderiza una lista de tarjetas `md:hidden` y la tabla `max-md:hidden`.

## R9 · Dashboard
- **Bucket**: enlace "Ver gastos" en el `CardHeader` de `BucketCard` → `/expenses?bucket=<bucket>`.
- **CardDueAlerts**: usa `useCardStatements()` y filtra `last.state !== "paid" && daysBetween(today, last.due) <= 7`. Cada alerta muestra nombre, "vence en N días"/"vencida", `<Money>` y Pagar (`openCreate` con `payAmount`). Se incluye en la franja móvil (`DashboardAlertStrip`) y en el bloque de alertas de escritorio.

## R10 · Gastos rápidos en Configuración
- **Decision**: nueva ruta `src/app/(app)/settings/quick-expenses/page.tsx` que monta `QuickExpensesSection` con `SettingsHeader`. Se agrega a `SETTINGS_SECTIONS` y a `APP_ROUTES` (e2e), y se quita de `ExpensesPage`. El enlace "Administrar" de la hoja ＋ y el enlace "crear el primero" del Dashboard apuntan a la nueva ruta.
