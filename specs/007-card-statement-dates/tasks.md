---
description: "Task list for spec 007 — Fechas de corte y pago de tarjetas desde el estado de cuenta"
---

# Tasks: Fechas de corte y pago de tarjetas desde el estado de cuenta

**Input**: Design documents from `specs/007-card-statement-dates/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: se incluyen. La constitución exige pruebas automatizadas de la lógica financiera y verificación en normal y demo, EN y ES. `contracts/domain.md`, `contracts/data-provider.md` (C1–C7) y `contracts/ui-components.md` definen qué se prueba.

**Organization**: tareas agrupadas por historia de usuario. Todo va en `main`, sin rama. US2 va antes que US1 (plan § Orden de implementación): es solo dominio y no toca datos. Requiere Docker y Supabase local (`pnpm db:start`); nunca correr pruebas contra la nube.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia del spec (US1–US3)

---

## Phase 1: Setup

**Purpose**: entorno local listo.

- [ ] T001 Confirmar que Supabase local corre (`pnpm db:start`) y que `pnpm test` pasa en verde antes de cambiar nada (línea base)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: los dos módulos puros que usan todas las historias.

**⚠️ CRITICAL**: ninguna historia empieza antes de terminar esta fase.

- [ ] T002 [P] Escribir `tests/unit/domain/business-days.test.ts` (en rojo) según `contracts/domain.md`:
  - `easterSunday` para 2024–2030 (2026 = 5 abr, 2027 = 28 mar).
  - Los 11 inhábiles de 2026 y de 2027 (FR-009): 1 ene, primer lunes de feb, tercer lunes de mar, Jueves Santo (Pascua − 3), Viernes Santo (Pascua − 2), 1 may, 16 sep, 2 nov, tercer lunes de nov, 12 dic, 25 dic.
  - `isBusinessDay`: sábado, domingo e inhábil → `false`.
  - `previousBusinessDay`: sáb 4 jul 2026 → vie 3 jul; sáb 4 abr 2026 → mié 1 abr (Semana Santa); vie 25 dic 2026 → jue 24 dic; un día hábil se devuelve igual.
- [ ] T003 Crear `src/domain/business-days.ts` (R1): `easterSunday(year): IsoDate` (algoritmo gregoriano anónimo), `bankHolidays(year): ReadonlySet<IsoDate>` memorizado por año en un `Map` de módulo, `isBusinessDay(date)` y `previousBusinessDay(date)`. Sin leer el reloj. T002 en verde
- [ ] T004 [P] Escribir `tests/unit/domain/card-terms.test.ts` (en rojo) según `contracts/domain.md`:
  - Tabla de las 6 tarjetas reales (spec US1-3): BBVA 5 nov→25 nov = (5, 20); Banregio 14 oct→4 nov = (14, 21); DiDi 22 nov→7 dic = (22, 15); Nu 23 oct→3 nov = (23, 11); Plata 10 oct→9 nov = (10, 30); Mercado Pago 27 nov→7 dic = (27, 10).
  - `dueDateFor` con los casos de research.md: Nu (23, 11) desde 23 jun → 3 jul, 23 sep → 2 oct, 23 oct → 3 nov; Banregio (14, 21) desde 14 nov → 4 dic; BBVA (5, 20) desde 5 dic → 24 dic.
  - Errores: `dueNotAfterCutOff` (límite igual o anterior al corte) y `dueTooFar` (61 días); 60 días es válido.
  - Avisos: Nu 23 sep → 5 oct da `dueMayHaveMoved`; corte 28 feb 2027 da `shortMonthCutOff`; BBVA 5 nov → 25 nov no da avisos.
  - `upcomingStatements` de BBVA al 7 nov 2026: 5 nov → 25 nov, 5 dic → 24 dic, 5 ene → 25 ene (filtra `dueOn ≥ today`).
  - `latestStatement` → `cardTermsFromStatement` da los mismos términos (ida y vuelta, FR-005), para las 6 tarjetas.
  - Invariante 2 de data-model.md: offset 1 con un día siguiente inhábil devuelve el nominal (nunca ≤ corte).
  - `rescheduleCardInstallments`: ignora las `collected`, incluye las `partial`, ignora las de otra tarjeta y devuelve `[]` cuando todo está al día.
- [ ] T005 Crear `src/domain/card-terms.ts` (R3/R4/R7) con `CardTerms`, `Statement`, `StatementError`, `StatementWarning`, `InstallmentDates`, `cardTermsOf`, `lastCutOffOn` (movida desde `src/domain/credit.ts`), `cutOffIn`, `nominalDueDate`, `dueDateFor` (invariante 2: si `previousBusinessDay(nominal) ≤ cutOffOn`, usar el nominal), `cardTermsFromStatement`, `statementWarnings`, `upcomingStatements(terms, today, count = 3)`, `latestStatement` (límite NOMINAL) y `installmentDatesFor(terms, purchaseDate, seq, lead)` + `rescheduleCardInstallments(card, receivables, installments, lead)` (solo las no cobradas de esa tarjeta cuyas fechas cambian). T004 en verde

**Checkpoint**: dominio listo; las historias pueden empezar.

---

## Phase 3: User Story 2 - Límites de pago en día hábil (Priority: P1)

**Goal**: todo límite de tarjeta que muestra o compara la app es el día hábil anterior si cae en fin de semana o inhábil (FR-008, FR-010).

**Independent Test**: Nu (23, 11): el estado del 23 sep 2026 vence el vie 2 oct y el del 23 jun el vie 3 jul; el del 23 oct, el mar 3 nov.

- [ ] T006 [US2] En `src/domain/credit.ts`: `cardStatus.nextPaymentDue = dueDateFor(...)`, `creditTimeline` usa `dueDateFor` para cada estado, `lastCutOffOn` se reexporta desde `./card-terms` y `requireCard` usa `cardTermsOf`
- [ ] T007 [US2] En `src/domain/installments.ts`: `buildCollectionSchedule` usa `installmentDatesFor` (que usa `dueDateFor`); `cutOffIn` y `statementCutOffFor` sin duplicar lógica con `card-terms.ts` (sin import circular)
- [ ] T008 [US2] En `src/data/mock/seed.ts`: `dueFor` usa `dueDateFor` para que el demo muestre los mismos límites (US2-5)
- [ ] T009 [US2] Ajustar `tests/unit/domain/credit.test.ts`, `tests/unit/domain/credit-timeline.test.ts` e `tests/unit/domain/installments.test.ts` (R8): las expectativas que caían en fin de semana o inhábil pasan a la fecha ajustada, con comentario; agregar en `credit.test.ts` un caso Nu donde `overdue` y `nextPaymentDue` usan la fecha ajustada (US2-3). `pnpm test` en verde

**Checkpoint**: Gastos, calendario de crédito, MSI nuevas y demo muestran límites ajustados.

---

## Phase 4: User Story 1 - Configurar una tarjeta con las fechas del estado de cuenta (Priority: P1) 🎯 MVP

**Goal**: el dueño captura corte y límite de un estado; la app deriva día y días, muestra 3 estados y avisos (FR-001…FR-007, FR-014, FR-015).

**Independent Test**: alta de tarjeta con 22 nov 2026 → 7 dic 2026: se ve "Corte el día 22 · vence 15 días después" y 3 estados; al guardar queda (22, 15).

- [ ] T010 [P] [US1] Agregar las 12 llaves de `contracts/ui-components.md` § i18n al namespace `settings` en `src/i18n/messages/es.json` y `src/i18n/messages/en.json` (`statementCutOff`, `statementDue`, `statementHint`, `upcomingStatements`, `statementRow`, `movedForHoliday`, `dueNotAfterCutOff`, `dueTooFar`, `dueMayHaveMoved`, `shortMonthCutOff`, `enterNumbers`, `useStatementDates`) más `statementSummary` ("Corte el día {day} · vence {offset} días después" / "Closes on day {day} · due {offset} days later"); conservar `cutOffDay`, `dueOffset`, `cardTerms`, `cardHint`
- [ ] T011 [US1] En `src/features/settings/accounts/schema.ts`: `termsMode: z.enum(["statement", "manual"])`, `statementCutOffOn: z.string()`, `statementDueOn: z.string()`. En modo statement con `kind = credit_card`, fechas vacías o inválidas → `invalidCutOffDate` / `invalidDueDate` en su campo; errores de `cardTermsFromStatement` → `dueNotAfterCutOff` / `dueTooFar` en `statementDueOn`; derivar `cutOffDay` y `paymentDueOffsetDays`. La salida (`AccountFormOutput`) no cambia. Agregar las llaves `invalidCutOffDate` / `invalidDueDate` a ambos diccionarios
- [ ] T012 [P] [US1] Ampliar `tests/unit/features/settings-schemas.test.ts`: los modos statement (22 nov → 7 dic) y manual (22, 15) producen la misma salida; `dueNotAfterCutOff` y `dueTooFar` salen en `statementDueOn`; con `kind ≠ credit_card` las fechas se ignoran
- [ ] T013 [US1] Crear `src/features/settings/accounts/CardTermsFields.tsx` (contracts/ui-components.md): modo statement con `#card-statement-cutoff` / `#card-statement-due` (`type="date"`), región `aria-live="polite"` `data-testid="card-terms-summary"` con el resumen, lista `data-testid="card-upcoming-statements"` (3 filas `statementRow` con `formatDate` del idioma, ícono + `movedForHoliday` si `dueOn ≠ nominal`), `Alert` de avisos y enlace `enterNumbers`; modo manual con `#account-cutoff` / `#account-due`, la misma vista previa y enlace `useStatementDates`. `today` desde el hook de fecha existente de la app
- [ ] T014 [US1] En `src/features/settings/accounts/AccountForm.tsx`: montar `CardTermsFields` en lugar de los dos campos numéricos; `defaultValues` con `termsMode: "statement"` y, al editar una tarjeta configurada, `latestStatement(terms, today)` (FR-005); al crear, fechas vacías
- [ ] T015 [P] [US1] Crear `tests/unit/features/card-terms-fields.test.tsx`: 22 nov / 7 dic muestra "día 22 · 15 días" y 3 estados; fechas inválidas muestran el error traducido; editar BBVA (5, 20) el 7 nov 2026 prellena 5 nov / 25 nov; el modo manual también muestra la vista previa; Nu 23 sep → 5 oct muestra el aviso sin bloquear

**Checkpoint**: alta y edición de tarjetas por fechas, en EN/ES; demo calcula y bloquea al guardar.

---

## Phase 5: User Story 3 - Mensualidades MSI al día cuando cambia la tarjeta (Priority: P2)

**Goal**: cambiar corte o días reprograma las mensualidades no cobradas en la misma transacción; un recálculo de arranque corrige las existentes (FR-011…FR-013).

**Independent Test**: MSI a 3 meses en tarjeta (15, 20) con la 1.ª cobrada; cambiar a (14, 21): la 2 y la 3 cambian `cardDueOn` y `dueOn`; la 1 no.

- [ ] T016 [US3] Crear `supabase/migrations/0010_update_card_terms.sql` (R6, contracts/data-provider.md): `public.update_account_with_installments(p_id uuid, p_patch jsonb, p_installments jsonb) returns public.accounts`, `language plpgsql security invoker set search_path = public`; aplica `p_patch` con `jsonb_populate_record` sobre la fila actual (`P0002` si no existe/no visible); actualiza cada `{id, due_on, card_due_on}` solo si su compra tiene `card_account_id = p_id` y `status <> 'collected'`; si las filas actualizadas ≠ tamaño del arreglo, `raise ... using errcode = '23514'`. `revoke all on function ... from public, anon; grant execute ... to authenticated`
- [ ] T017 [US3] Crear `supabase/tests/card-terms.test.sql` (pgTAP): C1–C3 a nivel SQL con reversión completa en C2/C3; usuario B recibe `P0002` con la tarjeta de A; `anon` no puede ejecutar la función. Correr `pnpm db:reset && pnpm db:test`
- [ ] T018 [US3] Regenerar `src/data/supabase/database.types.ts` con `pnpm db:types`
- [ ] T019 [US3] En `src/data/provider.ts`: `AccountsRepository.update(id, patch, reschedule?: readonly InstallmentDates[])` con su JSDoc; en `src/data/supabase/repos/accounts.ts`, con `reschedule` no vacío llamar `db.rpc("update_account_with_installments", ...)` (patch con `fromAccount`, arreglo en snake_case) y traducir `P0002` → `NOT_FOUND` y `23514` → `VALIDATION` (revisar el mapeo de errores existente en `exec`); sin `reschedule`, el `update` de hoy. En `src/data/mock/provider.ts`, firma nueva (sigue `denyWrite`)
- [ ] T020 [US3] En `tests/utils/memory-provider.ts`: `accounts.update` con `reschedule` replica la RPC (valida tarjeta y estado, todo o nada, `NOT_FOUND` / `VALIDATION`)
- [ ] T021 [US3] En `tests/contract/data-provider.contract.ts`: casos C1–C6 (escritura) y C7 (demo, junto a `accounts.update` en la lista de `DemoReadOnlyError`). Correr `pnpm test:contract:local`
- [ ] T022 [US3] En `src/features/settings/accounts/hooks.ts`: `useUpdateAccount` calcula `rescheduleCardInstallments` con la cuenta resultante cuando el patch cambia `cutOffDay` o `paymentDueOffsetDays` (lee `collectionLeadDays` de settings del snapshot), lo pasa a `accounts.update` y la parte optimista aplica también las fechas a `installments`
- [ ] T023 [US3] Crear `src/features/receivables/useRescheduleInstallments.ts` (BackgroundSync, R7): `plan` = primera tarjeta activa con cambios → `{ cardId, changes }` o `null`; `write` = `accounts.update(cardId, {}, changes)` → plan; `merge` = aplica `changes` a `installments`. Montarlo en `src/components/layout/AppShell.tsx` junto a `useMaterializeRecurring()`
- [ ] T024 [P] [US3] Pruebas unitarias del hook y la mutación en `tests/unit/features/background-writers.test.tsx` (o archivo nuevo `tests/unit/features/reschedule-installments.test.tsx`): idempotencia (aplicar el plan y volver a planear da `null`), cambio solo de nombre → sin `reschedule`, cambio de términos → `reschedule` con las no cobradas

**Checkpoint**: reprogramación atómica y recálculo de arranque.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Crear `tests/e2e/us14-card-statement-dates.spec.ts`: `@demo` (abrir una tarjeta del demo, ver fechas prellenadas y 3 estados, guardar muestra solo lectura, axe sin violaciones serias en el diálogo, EN y ES) y `@live` (tarjeta con compra MSI a 3 meses; cambiar el corte por fechas → Por cobrar muestra las fechas nuevas). Revisar e2e existentes que lean fechas de límite del seed (R8)
- [ ] T026 Puertas: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, `pnpm db:reset && pnpm db:types && pnpm db:test`, `pnpm test:contract:local`, `pnpm test:e2e:local`, `pnpm check:demo-bundle`
- [ ] T027 Nube (quickstart § 4): aplicar `0010_update_card_terms.sql` a `potodtpkgadgsmeuuafx`, revisar advisors de seguridad, desplegar desde git (push a `main`)
- [ ] T028 Abrir la app una vez en producción y verificar con SQL de solo lectura: la mensualidad pendiente de Banregio queda con `card_due_on = 2026-12-04` y `due_on = 2026-12-01`; las 6 tarjetas conservan sus términos (SC-006)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T005)** → historias.
- **US2 (T006–T009)** depende solo de la base.
- **US1 (T010–T015)** depende de la base; independiente de US2 (comparte `dueDateFor`).
- **US3 (T016–T024)** depende de la base y de `installmentDatesFor` (T005/T007).
- **Polish (T025–T028)** al final; T027 requiere T026 en verde; T028 requiere T027.

## Parallel Opportunities

- T002 ∥ T004 (pruebas de dominio, archivos distintos).
- T010 ∥ T012 ∥ T015 dentro de US1 (diccionarios, pruebas de esquema y de componente).
- T016–T018 (SQL) ∥ T022–T023 (hooks) una vez cerrada la firma de T019.

## Implementation Strategy

1. Base + US2: el riesgo principal (pagar tarde) queda cubierto solo con dominio.
2. US1: MVP de captura por fechas.
3. US3: atomicidad y recálculo de arranque.
4. Puertas, nube, verificación de Banregio.
