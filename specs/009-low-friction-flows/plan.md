# Implementation Plan: Flujos y formularios con menos fricción

**Branch**: `main` (sin rama de feature) | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-low-friction-flows/spec.md`

## Summary

Solo UI, sobre la base del spec 008 (diálogos únicos en `DialogHost`, `useUi.openCreate`):
- **Recordar lo último usado**: slice persistido `lastUsed` en `src/store/preferences.ts`. Los diálogos lo leen como default, validado contra cuentas y subcategorías activas.
- **Reintentar**: `useSnapshotMutation` gana `onFailure(error, variables)` (nivel mutación, así corre aunque el diálogo ya esté desmontado). Gasto, ingreso y cuenta por cobrar muestran un toast con "Reintentar", que llama `openCreate({kind, draft})`; los diálogos aceptan `draft` como valores iniciales.
- **Deshacer diferido**: store `pending-deletes` (zustand, en memoria) + `useFinanceSnapshot` que oculta los pendientes en todo selector. `useDeferredDelete()` encola, programa la confirmación a 6 s y la ejecuta también en `pagehide`; si falla, revierte.
- **Estados de página**: componente `PageQueryState` (cargando / error con Reintentar / contenido) y hook `useSnapshotStatus()`.
- **Formularios**: chips de fecha, subcategorías recientes (`recentSubcategories` puro), "Guardar y agregar otro", autofocus, `inputMode` y sugerencia de metas como valor.
- **Montos**: `parseMoneyInput` acepta coma decimal; las pruebas de propiedades se amplían.
- **Listas y filtros**: filas tocables y agrupadas por día (`groupByDay` puro), menús ⋯, cuotas como tarjetas, filtros de Gastos y Bitácora en la URL (`useSearchParams`), presets y búsqueda normalizada.
- **Dashboard**: enlaces de bucket y `CardDueAlerts` (usa `cardStatementSummary`).
- **Gastos rápidos** en `/settings/quick-expenses`.

Detalle en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (`strict`).
**Primary Dependencies**: Next.js 16.4 (App Router: `useSearchParams`, `useRouter`), React 19.3, TanStack Query 5, Zustand 5 (persist), react-hook-form + zod, shadcn/ui, sonner, lucide-react. **Sin dependencias nuevas.**
**Storage**: localStorage del dispositivo (preferencias existentes, ahora con `lastUsed`). Sin cambios de esquema.
**Testing**: Vitest (dominio puro, fast-check para `parseMoneyInput`, componentes y hooks), Playwright demo EN/ES; los e2e de escritura llevan `@live` y no se ejecutan (decisión del usuario).
**Target Platform**: Vercel (personal y demo).
**Performance Goals**: First Load de `/dashboard` ≤ +20 kB respecto a la línea base (T001).
**Constraints**:
- Demo read-only: el rechazo ocurre antes del borrado optimista.
- Privacidad: todo monto con `<Money>`.
- Reglas de motion del 003.
- 320 px sin scroll horizontal.
**Scale/Scope**: unos 12 archivos nuevos y unos 30 tocados.

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| I. Zero-cost | Sin servicios; el borrado diferido corre en el cliente. ✅ |
| II. TS estricto | Funciones puras con pruebas (`parse`, `recentSubcategories`, `groupByDay`, `ledgerPreset`, `matchesSearch`); TanStack + Zustand. ✅ |
| III. RLS | Sin cambios de backend. ✅ |
| IV. Demo aislado | `useDeferredDelete` y los guardados consultan `canWrite` y notifican solo lectura sin tocar la UI; `check:demo-bundle`. ✅ |
| V. Privacidad | `lastUsed` guarda solo identificadores, nunca montos; los borradores de "Reintentar" viven en memoria y nunca se persisten. ✅ |
| VI. i18n | Llaves nuevas EN/ES; fechas con `formatDate`. ✅ |

## Project Structure

```text
src/domain/
├── parse.ts                   # coma decimal
├── recent.ts                  # nuevo: recentSubcategories(expenses, subcategories, n=6)
├── day-groups.ts              # nuevo: groupByDay(rows, today) → [{date, label:"today"|"yesterday"|"date", rows}]
└── ledger-presets.ts          # nuevo: presetRange(preset, today), normalizeSearch, matchesSearch
src/store/
├── preferences.ts             # lastUsed {paymentAccountId, subcategoryId, depositAccountId, sourceAccountId} + setLastUsed
├── pending-deletes.ts         # nuevo: entradas {key, apply(snapshot)} en memoria
└── ui.ts                      # CreateDialog gana draft (expense/income) y kind "receivable"
src/data/
├── snapshot-cache.ts          # onFailure(error, variables)
└── useFinanceSnapshot.ts      # aplica pending-deletes; useSnapshotStatus()
src/components/
├── data/PageQueryState.tsx    # nuevo
├── layout/DialogHost.tsx      # + LazyAddReceivableDialog
├── layout/CreateSheet.tsx     # enlace "Administrar"
└── ui/chip.tsx                # nuevo: Chip (toggle con aria-pressed, 44 px táctil)
src/features/shared/
├── use-deferred-delete.ts     # nuevo
├── retry-toast.ts             # nuevo: notifySaveFailed(kind, draft)
└── last-used.ts               # nuevo: useLastUsedDefaults() validado
src/features/expenses/         # AddExpenseDialog (fechas, recientes, guardar y otro, borrar, draft), ExpensesPage
                               # (quincena en el header, chips, URL, grupos por día, fila tocable), SpendingByMethod
                               # (recibe periodo), QuickExpensesSection → settings
src/features/income/           # RegisterIncomeDialog (lastUsed, autofocus, draft), IncomePage (deshacer)
src/features/expenses/CardPaymentDialog.tsx   # lastUsed sourceAccountId
src/features/recurring/        # RecurringForm (lastUsed, autofocus, día de hoy), RecurringPage (deshacer)
src/features/receivables/      # AddReceivableDialog (draft/Reintentar), ReceivablesPage (tarjetas en móvil)
src/features/ledger/           # filtros en URL, presets, búsqueda, filas tocables
src/features/safe-to-spend/    # BucketCard enlace, CardDueAlerts
src/features/goals/GoalForm.tsx               # sugerencia como valor
src/features/settings/         # preferences inputMode, settings-sections + quick-expenses, taxonomy ⋯
src/app/(app)/settings/quick-expenses/page.tsx  # nueva ruta
src/i18n/messages/{en,es}.json
tests/unit/... ; tests/e2e/flows.spec.ts (demo + @live)
```

## Orden de implementación

1. Base: `parse` (coma), dominio puro (`recent`, `day-groups`, `ledger-presets`), `lastUsed`, `pending-deletes` + `useFinanceSnapshot`, `onFailure`, `PageQueryState`, `Chip` e i18n.
2. US1 registrar más rápido → US2 no perder nada → US3 estados de página (P1).
3. US4 listas → US5 filtros → US6 Dashboard (P2) → US7 gastos rápidos en Configuración (P3).
4. Pulido: e2e, a11y, bundle.

## Complexity Tracking

Sin violaciones.
