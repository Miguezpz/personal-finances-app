# Implementation Plan: Quincena según el día real de pago

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-pay-calendar/spec.md`

## Summary

Cada quincena empieza el día en que llega el pago que la financia. Si el día de pago cae en fin de semana, empieza el viernes anterior. Si hay un ingreso de tipo quincena registrado a ±7 días del día esperado, su fecha manda.

**Enfoque**:
- `Period` gana un **rango efectivo** `from..to`. `start` y `end` siguen siendo nominales (día 1/16) y funcionan como identificador. Por defecto `from = start` y `to = end`, así que el código que no conoce el calendario se comporta igual que hoy.
- Un módulo puro nuevo, `pay-calendar.ts`, calcula el inicio efectivo de cada quincena a partir de Preferencias y de los ingresos de tipo quincena. No se guarda nada (R1).
- Los gastos y los cargos recurrentes se asignan por rango efectivo. Las asignaciones y las aportaciones a metas se asignan por su clave guardada (R2).
- El Dashboard, Gastos, Ingresos, Crédito y Patrimonio usan el calendario a través de un hook `usePayCalendar` (R5).
- El seed del demo deposita la quincena en el día de pago movido (R6).
- **Sin migración ni cambios en Supabase.**

## Technical Context

**Language/Version**: TypeScript 5 (`strict`).

**Primary Dependencies**: Next.js 16.4 (App Router), React 19.3, next-intl 4, TanStack Query 5. **Sin dependencias nuevas.**

**Storage**: sin cambios. Supabase Postgres (nube, free plan). No hay migración.

**Testing**: Vitest (dominio, con pruebas que fallan primero), paridad i18n y Playwright en demo (EN/ES), con `page.clock` fijado al 13 de nov de 2026.

**Target Platform**: web en Vercel (despliegues personal y demo).

**Project Type**: aplicación web Next.js, un solo proyecto.

**Performance Goals**: `periodOfDate` es O(1) amortizado: unas cuantas búsquedas en un `Map` y aritmética de fechas. Safe-to-Spend sigue siendo O(movimientos + quincenas) y tarda < 5 ms con 5 años de historial.

**Constraints**:
- Costo cero y cálculo en el cliente (Principios I y V).
- Demo sin backend.
- Todo texto nuevo en diccionarios EN/ES.
- 360 px sin scroll horizontal.

**Scale/Scope**: 1 usuario real. Unos 2 archivos nuevos y unos 16 tocados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento |
| --------- | ------------ |
| I. Zero-cost | Sin servicios, dependencias, cron ni migración. ✅ |
| II. TS estricto y stack | Lógica pura y tipada en `src/domain/pay-calendar.ts`, sin `any`. Hook con `useMemo` sobre el snapshot. ✅ |
| III. Supabase con RLS | No se toca la base de datos. ✅ |
| IV. Demo aislado | El seed sigue siendo ficticio; solo cambia la fecha de depósito al viernes. ✅ |
| V. Privacidad / cliente | El calendario se calcula en el cliente. No se agregan montos nuevos a la UI. ✅ |
| VI. i18n y multi-divisa | Nota nueva en EN/ES con paridad probada. Rango con `formatDate`. ✅ |
| Flujo | La lógica financiera (calendario, Safe-to-Spend, recurrentes) tiene pruebas unitarias antes de cerrarse. Verificación en demo EN/ES y en normal tras el despliegue. ✅ |

**Re-check post-diseño**: sin violaciones. Agregar `from`/`to` a `Period` con valores por defecto nominales evita tocar a los consumidores que no necesitan el calendario (por ejemplo, `goals.ts` y `csv.ts`).

## Project Structure

### Documentation (this feature)

```text
specs/006-pay-calendar/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/domain.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/
├── types.ts              # Period.from / Period.to
├── periods.ts            # makePeriod llena from/to nominales; fundedPeriodFor(receivedOn, settings);
│                         # se elimina daysUntilNextPayday (pasa a pay-calendar)
├── pay-calendar.ts       # nuevo (contracts/domain.md)
├── safe-to-spend.ts      # SafeToSpendInput.calendar; groupByPeriod por rango efectivo
├── recurring.ts          # occurrencesBetween / recurringStatusForPeriod usan from..to
├── spending-by-method.ts # filtra por from..to
├── net-worth.ts          # arma el calendario y usa periodOfDate
├── credit.ts             # timeline: paydays con toPrevFridayIfWeekend
└── payment-sessions.ts   # paydaysIn con toPrevFridayIfWeekend

src/lib/use-pay-calendar.ts                  # nuevo: useMemo(buildPayCalendar(settings, incomes))

src/features/
├── safe-to-spend/useSafeToSpend.ts · Dashboard.tsx      # periodOfDate(today); rango + nota "se adelantó"
├── expenses/ExpensesPage.tsx · SpendingByMethod.tsx     # quincena actual y navegación con rango efectivo
├── income/format.ts                                     # formatPeriodRange(period) usa from..to
├── income/IncomePage.tsx · RegisterIncomeDialog.tsx     # sugerencia por día de pago más cercano; rangos efectivos
src/data/mock/seed.ts                                    # receivedOn = día de pago movido
src/i18n/messages/{en,es}.json                           # nota "paydayMovedEarly"

tests/
├── unit/domain/pay-calendar.test.ts (nuevo) · payday.test.ts · funded-period.test.ts
│   · safe-to-spend.test.ts · recurring.test.ts · spending-by-method.test.ts · credit-timeline.test.ts
│   · payment-sessions.test.ts · net-worth.test.ts
├── unit/data/mock-seed-consistency.test.ts
└── e2e/us16-pay-calendar.spec.ts (nuevo) · us2-safe-to-spend · us3-recurring · us4-expenses · us1-income-split
```

**Structure Decision**: un solo proyecto Next.js con las capas que ya existen (dominio puro → proveedor de datos → features → componentes).

## Fases de implementación (para `/speckit-tasks`)

1. **Fundacional (bloquea todo)**: `Period.from/to`, `pay-calendar.ts` con sus pruebas (que fallan primero) y `fundedPeriodFor` con la regla del día de pago más cercano.
2. **US1 + US2 (P1)**:
   - `safe-to-spend.ts`, `recurring.ts` y `net-worth.ts` con el calendario.
   - `usePayCalendar`, `useSafeToSpend` y el seed del demo.
   - Gastos: quincena actual, navegación y gasto por método.
   - Pruebas del 30 de oct y del 13 de nov de 2026.
3. **US3 (P2)**: override por ingreso (ya incluido en el calendario) y sugerencia del diálogo de ingreso. Rangos efectivos en Ingresos.
4. **US4 (P3)**: rango y nota en el Dashboard; días al próximo pago; paydays movidos en el timeline de Crédito y en las sesiones de pago.
5. **Cierre**:
   - i18n con paridad; e2e en demo EN/ES y regresión.
   - `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
   - Docs: README y `docs/ux-roadmap.md` si mencionan las quincenas fijas.

## Complexity Tracking

Sin violaciones que justificar.
