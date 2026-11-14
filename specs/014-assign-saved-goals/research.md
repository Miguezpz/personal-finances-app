# Research: Usar lo Ahorrado en metas

## R1 — Movimientos de Ahorrado en una tabla nueva

- **Decision**: tabla `goal_saved_moves` (migración `0014`). Una fila por asignación o regreso, con `amount_cents` **con signo**: positivo = asignación (Ahorrado → meta), negativo = regreso (meta → Ahorrado). Sin `update` ni `delete` desde el cliente; solo `insert`. Se borran solo en cascada al borrar la meta.
- **Rationale**:
  - `goal_contributions` tiene `unique (goal_id, period_start)` y `period_start` solo admite días 1 y 16, así que no admite varios movimientos por quincena (spec: "varios por meta y por quincena").
  - Con signo, todo lo derivado es una suma: neto de la meta = Σ, total asignado − total regresado = Σ. Sin ramas por tipo.
  - El CSV se lee igual: monto positivo es asignación, negativo es regreso.
- **Alternatives considered**:
  - Columna `kind` (`assign`/`return`) + monto positivo: igual de válida, pero cada suma necesita un `case`. Se descartó por más código sin ganancia.
  - Reusar `goal_contributions` quitando el `unique`: rompe la idempotencia de las aportaciones automáticas (`addContributions` hace `upsert` sobre ese `unique`).

## R2 — Tipo de meta `purchase`

- **Decision**:
  - `alter type public.goal_kind add value 'purchase'`.
  - Columnas nuevas en `goals`: `target_cents bigint check (> 0)` y `completed_at timestamptz`.
  - La fecha objetivo reusa la columna **existente** `due_month date` (hoy sin uso en la app), con `check (extract(day from due_month) = 1)`.
  - El `check` de forma por tipo se reemplaza: `purchase` exige `target_cents` y `monthly_cents is null` (FR-008).
  - En el `check`, el tipo se compara como texto (`kind::text = 'purchase'`).
- **Rationale**:
  - Postgres no permite **usar** un valor de enum agregado en la misma transacción (`unsafe use of new value`). Comparar `kind::text` evita usar el literal del enum y deja la migración en un solo archivo y una transacción.
  - `due_month` ya existe y es un mes; no hace falta otra columna.
  - `source_bucket` sigue `not null`. Para una Compra no se usa (no tiene aportaciones). El formulario guarda `investment` y no muestra el campo. Así no cambia el tipo `Goal.sourceBucket` ni sus usuarios.
- **Alternatives considered**:
  - Reusar `annual_cents` como objetivo de la Compra: ahorra una columna pero mezcla dos significados en `Goal.annual`. Se descartó.
  - Hacer `source_bucket` nullable: correcto pero toca `dueContributions`, el formulario y el mapper por un valor que nunca se lee. Se descartó.
  - Dos migraciones (enum primero, luego el `check`): el dueño pidió una sola `0014`.

## R3 — "Cumplida"

- **Decision**: `Goal.completed: boolean` ↔ `completed_at`. "Lo compré" hace `update({ archived: true, completed: true })`; "Restaurar" en una cumplida hace `update({ archived: false, completed: false })`.
  - `check (completed_at is null or (archived_at is not null and kind::text = 'purchase'))`.
- **Rationale**: una cumplida es una archivada con marca. Las listas que ya separan activas/archivadas siguen igual; solo se agrega la etiqueta "Cumplida" y se bloquean Asignar y Regresar.

## R4 — Fórmulas (todo derivado en el cliente)

- `net(goal) = Σ moves.amount` de esa meta.
- `available = savedTotal − Σ moves.amount` (todas las metas, también archivadas y cumplidas). Se muestra `max(available, 0)`; si `available < 0`, la tarjeta muestra el aviso "lo asignado supera lo ahorrado" (FR-002, SC-002).
- Avance:
  - Compra: `net(goal)`; barra = `min(net / target, 1)`.
  - Fondo de emergencia: aportaciones de siempre + `net(goal)` (también entra a `monthsCovered`).
  - Apartado: aportaciones del año + `net(goal)`. El neto no se filtra por año porque es dinero que sigue en la meta hasta que se regrese, y debe coincidir con el máximo de "Regresar".
- Máximos: asignar ≤ `max(available, 0)`; regresar ≤ `net(goal)`. Ambos > 0.
- **Rationale**: es la misma regla de la spec 013 (nada derivado se guarda), así que editar el pasado nunca deja datos desincronizados.

## R5 — Patrimonio

- **Decision**: `assets += sts.saved.total − Σ net(goal) de metas cumplidas`.
- **Rationale**:
  - Asignar y regresar no aparecen en la fórmula, así que no la cambian (FR-012, SC-003).
  - "Lo compré" resta exactamente lo neto de esa meta; restaurar lo devuelve (FR-018).
  - Se resta aunque el ajuste esté apagado: el dinero ya se gastó, y el sobrante que vuelve a arrastrarse se sigue contando en el disponible.
- Prueba: igualdad de patrimonio antes/después de asignar y regresar; diferencia exacta al cumplir.

## R6 — Safe-to-Spend

- **Decision**: `safe-to-spend.ts` no se toca. Los movimientos no entran a `computeSafeToSpend` (no son aportaciones ni gastos).
- **Rationale**: FR-012 y SC-005. La prueba es que las pruebas existentes pasan sin cambios y una nueva que compara el STS con y sin movimientos.

## R7 — Borrar una meta (FR-014)

- **Decision**: FR-014 se cumple por construcción: la FK `on delete cascade` borra los movimientos y `available` es derivado. Lo cubre el pgTAP (borrar meta ⇒ sus movimientos desaparecen). Botón "Eliminar" (con Deshacer, spec 009) solo en metas **sin aportaciones** (`goal_contributions`); las demás se archivan.
- **Rationale**: la cascada también borraría las aportaciones y reescribiría el Disponible para gastar y el patrimonio neto. La guarda vive en la UI (un solo usuario por cuenta).

## R8 — Validación en la base

- **Decision**: la base valida forma (monto ≠ 0, meta del mismo dueño, RLS). Los topes (≤ disponible, ≤ neto de la meta) se validan en el cliente con zod.
- **Rationale**: el disponible depende de Ahorrado, que es derivado en el cliente (no existe en la base). Un solo usuario por cuenta.
- `shortcut: la base no impide regresar más de lo neto de una meta; agregar un trigger si algún día hay más de un cliente escribiendo.`

## R9 — Captura del monto y de la fecha

- Monto: `parseMoneyInput` + `formatCentsAsInput`, como `CollectionDialog`. Se captura en MXN, igual que el resto de la app.
- Fecha objetivo: `<Input type="month">` (valor `YYYY-MM`). En navegadores sin selector de mes queda como texto; zod valida `^\d{4}-(0[1-9]|1[0-2])$` o vacío. Se guarda como el día 1 del mes.
- Fecha de cada movimiento: `useToday()` del cliente, para que coincida con la zona horaria de la app.

## R10 — UI

- **Un solo diálogo** `SavedMoveDialog` con `mode: "assign" | "return"`:
  - Desde la tarjeta Ahorrado: modo asignar, con selector de meta (metas activas no cumplidas).
  - Desde una meta: modo asignar o regresar con la meta ya elegida.
  - El esquema se construye con el máximo (`makeSavedMoveSchema(max)`), como `makeQuickExpenseOverrideSchema`.
- `SavedCard` gana la fila "Disponible para asignar", el aviso y el botón "Asignar" (SC-001: Asignar → meta y monto → confirmar).
- `GoalsPage`: sección de Compras (barra, "$X de $Y", mes y año), botones Asignar / Regresar / Lo compré, etiqueta "Cumplida".
- Asignar solo aparece con `saveSurplus` encendido (`sts.saved !== null`). Regresar aparece siempre que `net > 0` y la meta no esté cumplida (también archivada, edge case de la spec).
- La escritura es optimista con `useSnapshotMutation` (SC-004).

## R11 — Demo

- `seed.ts`: meta Compra "New laptop", objetivo $25,000, mes objetivo a ~4 meses, y una asignación de $3,000 con fecha de hoy.
- El monto debe ser menor que el total ahorrado del demo para no mostrar el aviso de $0. Lo comprueba una prueba unitaria sobre el seed.
- `goals.addSavedMove` del mock pasa por `denyWrite`.
