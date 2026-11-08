# Data Model: Navegación y consistencia del shell

Sin cambios de esquema ni de datos persistidos. Solo hay tipos de UI y un valor derivado.

## NavItem (`src/components/layout/nav-items.ts`)

| Campo | Tipo | Notas |
|---|---|---|
| href | string | Ruta |
| labelKey | clave de `nav` | |
| icon | LucideIcon | |
| group | `"main" \| "plan" \| "debts" \| "insights" \| "footer"` | Nuevo |

- `NAV_GROUPS`: `[{ id: "main", items: [dashboard, expenses, income, credit] }, { id: "plan", items: [recurring, goals] }, { id: "debts", items: [receivables] }, { id: "insights", items: [ledger, netWorth] }, { id: "footer", items: [settings] }]`.
- `MOBILE_BAR_ITEMS`: dashboard, expenses, credit (el ＋ y "Más" no son destinos).
- `isSecondaryRoute(pathname)`: true si no coincide con ningún item de la barra (`pathname === href || startsWith(href + "/")`).

## CreateDialog (`src/store/ui.ts`)

```ts
type CreateDialog =
  | { kind: "expense"; expense?: Expense | null }
  | { kind: "income"; income?: Income | null }
  | { kind: "card-payment"; cardId?: Uuid | null; suggestedAmount?: Cents | null };
```

Estado: `activeDialog: CreateDialog | null`, `createSheetOpen: boolean`. Acciones: `openCreate(d)` (cierra la hoja ＋, "Más" y "Apariencia" antes de abrir), `closeDialog()` y `setCreateSheetOpen(open)`. Se elimina el `DialogId` anterior (sin usos).

## CardStatementSummary (`src/domain/credit.ts`, derivado)

| Campo | Tipo | Regla |
|---|---|---|
| cardId | Uuid | |
| last.cutOff | IsoDate | `lastCutOffOn(cutOffDay, today)` |
| last.due | IsoDate | `dueDateFor(terms, last.cutOff)` |
| last.outstanding | Cents | `cardStatus(...).payToAvoidInterest` |
| last.state | `"paid" \| "pending" \| "overdue"` | `outstanding = 0` → paid; `today > due` → overdue; otro → pending |
| next.cutOff | IsoDate | corte del mes siguiente a `last.cutOff` |
| next.due | IsoDate | `dueDateFor(terms, next.cutOff)` |
| next.amount | Cents | `max(0, cumulative(next.cutOff) − last.outstanding)` |
| totalDebt | Cents | `cardStatus(...).totalDebt` |
| headline | `"last" \| "next"` | `last.state === "paid"` → next |
| payAmount | Cents | monto del headline |

Transiciones: pending → paid (pago que cubre el monto) · pending → overdue (pasa el límite) · overdue → paid (pago).
