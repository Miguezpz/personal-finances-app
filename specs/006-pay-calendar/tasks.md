# Tasks: Quincena según el día real de pago

**Input**: `specs/006-pay-calendar/` (plan, spec, research, data-model, contracts/domain.md, quickstart)

**Formato**: `- [ ] T### [P] [USn] descripción con ruta`.
- Sin Docker, Supabase ni migraciones; e2e solo en modo demo.
- Las pruebas de dominio se escriben primero y deben fallar (constitución: la lógica financiera lleva pruebas).
- Rutas relativas a la raíz del repo.

## Phase 1: Fundacional (bloquea todo)

- [X] T001 En `src/domain/types.ts`, agregar a `Period` los campos `from: IsoDate` ("inicio efectivo; por defecto start") y `to: IsoDate` ("fin efectivo; por defecto end"). En `src/domain/periods.ts`, `makePeriod` los llena con `start` y `end`. Corregir los literales de `Period` que fallen en `pnpm typecheck` (pruebas y fixtures).
- [X] T002 [P] Crear `tests/unit/domain/pay-calendar.test.ts` con los casos de quickstart §1:
  - Sábado y domingo pasan a viernes; entre semana no cambia.
  - `2026-11-13` → `2026-11-2`, rango 13–29 nov.
  - `2026-10-31` y `2026-11-12` → `2026-11-1`, rango 30 oct – 12 nov.
  - Día 31 en febrero y en abril.
  - 31 dic 2026 → `2027-01-1`, rango 31 dic – 14 ene.
  - Override `salary` el 16 nov → inicio 16 nov y la quincena anterior termina el 15.
  - Override a +8 días se ignora; override de tipo `extra` se ignora.
  - Con dos `salary` válidos manda el más temprano.
  - Un override que no queda estrictamente entre los esperados de las vecinas se ignora.
  - `daysUntilNextPayday`: 13 nov → 0; 14 nov → 16.
  - Propiedad con fast-check: para fechas de 2020–2030 con días de pago por defecto, `periodOfDate(d).from ≤ d ≤ .to` y `to + 1 día = next.from`.
- [X] T003 Crear `src/domain/pay-calendar.ts` según `contracts/domain.md`:
  - `toPrevFridayIfWeekend` (`getUTCDay` inline: 6 → −1, 0 → −2).
  - `nominalPayday`: mitad 2 ← `firstPayday` de M; mitad 1 ← `secondPayday` de M−1; ambos con `clampChargeDay`.
  - `expectedStart`, `buildPayCalendar`, `withRange`, `periodOfDate` (bucles `while` atrás y adelante desde `periodOf`) y `daysUntilNextPayday`.
  - T002 debe pasar.
- [X] T004 En `src/domain/periods.ts`:
  - `fundedPeriodFor(receivedOn, settings)` elige, entre la quincena anterior, la actual y la siguiente de `periodOf(receivedOn)`, la de `expectedStart` más cercano. Si empatan, gana la posterior.
  - Eliminar `daysUntilNextPayday` de este archivo.
  - Mover y ajustar los casos de `tests/unit/domain/payday.test.ts` a la versión con calendario.
  - Ajustar `tests/unit/domain/funded-period.test.ts`: 15 → 16 y último día → 1 sin cambio. Nuevos: 13 nov 2026 → 16 nov; 16 nov 2026 → 16 nov; día 3 → día 1 del mismo mes.

## Phase 2: US1 + US2 — El disponible cambia el día de pago y los gastos salen del dinero nuevo (P1) 🎯 MVP

**Independent test**: con hoy en 13 nov 2026, el Dashboard muestra `2026-11-2`, incluye el ingreso nuevo, y un gasto de hoy baja el disponible sin cambiar el cierre de `2026-11-1`.

- [X] T005 [P] [US2] En `tests/unit/domain/safe-to-spend.test.ts`, casos que fallan primero:
  - Gasto del 13 nov 2026 → cuenta en `2026-11-2`.
  - Gasto del 31 oct 2026 → cuenta en `2026-11-1`.
  - La asignación con `periodStart 2026-11-16` está en `2026-11-2` aunque hoy sea 13.
  - El arrastre de `2026-11-1` excluye el gasto del 13.
- [X] T006 [P] [US2] En `tests/unit/domain/recurring.test.ts`, casos que fallan primero: un cargo con `chargeDay 31` en oct 2026 se reserva en `2026-11-1` con rango efectivo y no en `2026-10-2`; `recurringStatusForPeriod` usa `from..to`.
- [X] T007 [US2] En `src/domain/safe-to-spend.ts`:
  - `SafeToSpendInput` gana `calendar: PayCalendar`.
  - `groupByPeriod` asigna gastos con `periodOfDate(e.spentOn, cal)` y asignaciones y aportaciones con `periodOf(periodStart)`, y descarta las que tengan `key > upTo.key`.
  - `daysUntilPayday` usa `daysUntilNextPayday(today, calendar)`.
  - T005 debe pasar.
- [X] T008 [P] [US2] En `src/domain/recurring.ts`, `unappliedOccurrences` y `recurringStatusForPeriod` usan `period.from` y `period.to`. T006 debe pasar.
- [X] T009 [P] [US2] En `src/domain/spending-by-method.ts`, filtrar por `period.from..to`, y actualizar `tests/unit/domain/spending-by-method.test.ts` si hace falta.
- [X] T010 [P] [US1] En `src/domain/net-worth.ts`, armar `buildPayCalendar(s.settings, s.incomes)` y usar `periodOfDate(asOf, cal)` y `calendar`. Verificar `tests/unit/domain/net-worth.test.ts`.
- [X] T011 [US1] Crear `src/lib/use-pay-calendar.ts`: `usePayCalendar()` = `useMemo(buildPayCalendar(settings, incomes))` sobre `useFinanceSnapshot`, con selector estable. Mientras carga, devuelve el calendario con `DEFAULT` settings y sin ingresos.
- [X] T012 [US1] En `src/features/safe-to-spend/useSafeToSpend.ts`, usar `periodOfDate(today, cal)` para `computeSafeToSpend` (con `calendar`) y para `recurringStatusForPeriod`.
- [X] T013 [US1] En `src/data/mock/seed.ts`, cada quincena se deposita en `toPrevFridayIfWeekend(díaNominal)`, con el filtro `≤ today` sobre la fecha movida. `fundedPeriodStart` se sigue calculando con el día nominal. Verificar `tests/unit/data/mock-seed-consistency.test.ts`.
- [X] T014 [US2] En `src/features/income/format.ts`, `formatPeriodRange(period: Period, locale)` muestra `from..to`. Actualizar sus llamadas en `src/features/safe-to-spend/Dashboard.tsx`, `src/features/expenses/SpendingByMethod.tsx`, `src/features/income/IncomePage.tsx` y `src/features/income/RegisterIncomeDialog.tsx`; las de Ingresos pasan `withRange(periodOf(start), cal)`.
- [X] T015 [US2] En `src/features/expenses/ExpensesPage.tsx`:
  - `current = periodOfDate(today, cal)`.
  - La quincena de la URL pasa por `withRange(periodFromKey(key), cal)`.
  - `within` usa `from..to`.
- [X] T016 [US2] En `src/features/expenses/SpendingByMethod.tsx` (`PeriodNavigator`), anterior y siguiente pasan por `withRange(…, cal)` e `isCurrent` compara `period.key >= periodOfDate(today, cal).key`.

**Checkpoint**: `pnpm typecheck && pnpm test` en verde. Con `pnpm dev:demo` y hoy 13 nov 2026, el Dashboard muestra la quincena nueva.

## Phase 3: US3 — Corregir el inicio con la fecha real del depósito (P2)

**Independent test**: un ingreso `salary` del 16 nov asignado a `2026-11-2` mueve el inicio al 16; el diálogo sugiere `2026-11-2` para un pago del 16.

- [X] T017 [US3] En `src/features/income/RegisterIncomeDialog.tsx`, las tres llamadas a `fundedPeriodFor` pasan `settings` del snapshot y las opciones muestran rangos efectivos. Actualizar el comentario del encabezado (`research.md R7`).
- [X] T018 [P] [US3] Si `tests/unit` tiene pruebas del diálogo de ingreso que fijen la quincena sugerida (`grep fundedPeriod tests/unit`), ajustarlas a la regla del día de pago más cercano.

## Phase 4: US4 — Rango, nota y paydays movidos (P3)

**Independent test**: con hoy en 13 nov 2026, el Dashboard muestra "13 nov – 29 nov", la nota de pago adelantado y "payday today"; el timeline de Crédito muestra el payday del 13 nov.

- [X] T019 [US4] En `src/features/safe-to-spend/Dashboard.tsx`, dentro de `period-info`, agregar `t("paydayMovedEarly")` con `data-testid="payday-moved-early"` cuando `data.period.from < nominalPayday(data.period, settings)`.
- [X] T020 [P] [US4] Agregar la clave `dashboard.paydayMovedEarly` en `src/i18n/messages/es.json` ("Pago adelantado al viernes") y en `en.json` ("Paid early on Friday"), con paridad.
- [X] T021 [P] [US4] En `src/domain/credit.ts` (timeline, ~L253), el payday es `toPrevFridayIfWeekend(clampChargeDay(...))`. Agregar un caso de nov 2026 en `tests/unit/domain/credit-timeline.test.ts`.
- [X] T022 [P] [US4] En `src/domain/payment-sessions.ts`, `paydaysIn` aplica `toPrevFridayIfWeekend`, y se ordena y deduplica. Ajustar `tests/unit/domain/payment-sessions.test.ts` si algún caso cae en fin de semana.

## Phase 5: Cierre

- [ ] T023 Crear `tests/e2e/us16-pay-calendar.spec.ts` (demo, EN y ES) con `page.clock.install` en 2026-11-13 18:00 UTC (mediodía en CDMX), igual que `us15`:
  - `period-info` contiene el rango 13–29 nov y `payday-moved-early`.
  - Un gasto rápido de Gustos baja el disponible de Gustos exactamente ese monto.
  - `/expenses` en la quincena actual lista el gasto de hoy.
- [ ] T024 Correr la regresión de e2e en demo: `us2-safe-to-spend`, `us3-recurring`, `us4-expenses`, `us4-spending-by-method`, `us1-income-split`, `us14-card-statement-dates` y `us15-card-paid-checklist`. Corregir los selectores o fechas que dependían del rango nominal.
- [ ] T025 Puertas: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] T026 [P] Docs: en `README.md` y `docs/ux-roadmap.md`, reemplazar la mención de quincenas fijas 1–15/16–fin por la regla del día real de pago (viernes si cae en fin de semana; corrección por fecha del ingreso). Actualizar el comentario de cabecera de `src/domain/periods.ts`.
- [ ] T027 Commit y push a `main` por fase (sin migración, así que no hay paso de nube). Verificar en la app personal tras el despliegue (quickstart §3).

## Dependencies

- La Phase 1 bloquea todo. T003 depende de T001; T004 depende de T003.
- Phase 2: T007 y T008 dependen de sus pruebas (T005 y T006). T011 va antes de T012, T014, T015 y T016. T013 es independiente.
- Las Phases 3 y 4 dependen de la Phase 2 (de `usePayCalendar` y `formatPeriodRange`), pero no entre sí.
- La Phase 5 va al final.

## Parallel examples

- Phase 1: T002 (prueba) en paralelo con T001.
- Phase 2: T005 ∥ T006 primero; después T008 ∥ T009 ∥ T010 ∥ T013 en paralelo con T007.
- Phase 4: T020 ∥ T021 ∥ T022.

## Implementation strategy

- **MVP**: Phases 1 y 2. Con eso el Dashboard ya muestra la quincena nueva el día de pago (hoy, 13 nov) y descuenta de ella los gastos.
- Después: US3 (sugerencia del diálogo), US4 (rango, nota y paydays movidos) y el cierre.

## Notas de implementación

- `fundedPeriodFor` quedó en `src/domain/pay-calendar.ts` y no en `periods.ts`. Necesita `expectedStart`, y dejarla en `periods.ts` habría creado un import circular. `payday.test.ts` se eliminó: sus casos viven ahora en `pay-calendar.test.ts`, ya con el ajuste de fin de semana.
- La nota del Dashboard dice "Pago adelantado" / "Paid early", sin "al viernes", porque también aparece cuando un ingreso registrado corrige el inicio a un día anterior al nominal.
- `groupByPeriod` guarda en caché la quincena de cada fecha. Sin esa caché, la prueba de rendimiento con 5 años de historial tardaba 368 ms, por encima del límite de 50 ms.
