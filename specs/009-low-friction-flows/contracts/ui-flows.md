# UI Contracts: flujos y formularios

## Dominio puro
```ts
parseMoneyInput("250,5") === 25050; parseMoneyInput("1,250") === 125000
recentSubcategories(expenses, subcategories, n = 6): Subcategory[]
groupByDay<T extends { date: IsoDate }>(rows: T[], today: IsoDate): { date: IsoDate; label: "today" | "yesterday" | "date"; rows: T[] }[]
presetRange(preset: LedgerPreset, today: IsoDate): { from: IsoDate; to: IsoDate }
normalizeSearch(s: string): string; matchesSearch(entry: { note?: string|null; description?: string }, q: string): boolean
```

## Hooks y componentes
- `useDeferredDelete(): { remove(input: { kind; id; label: string }): void }`. Testids del toast: botón "Deshacer" (texto `common.undo`).
- `useSnapshotStatus(): { isPending; isError; refetch }`; `<PageQueryState status skeleton={<…/>}>`, que en error muestra `data-testid="page-error"` y `page-retry`.
- `notifySaveFailed({ kind, draft, entity? })` → toast de error con la acción `common.retry`.
- `<Chip pressed onPressedChange>`: `button[aria-pressed]`, `pointer-coarse:min-h-11`.

## Testids nuevos
- Gasto: `date-chip-today|yesterday|other`, `recent-subcategory` (cada chip), `save-and-add`, `delete-expense`.
- Gastos: `expenses-period` (selector en el header), `filter-bucket-needs|wants`, `filter-method-<id|none>`, `clear-filters`, `day-group` (`data-label`), `expense-row` (botón en móvil).
- Bitácora: `ledger-preset-<preset>`, `ledger-search`, filas `ledger-row` y `ledger-card` con `data-editable`.
- Dashboard: `bucket-<bucket>-link`, `card-due-alerts` (`data-count`; enmienda 2026-11-09, antes `card-due-alert` por tarjeta).
- Hoja ＋: `create-manage-quick`.
- Por cobrar: `installment-card` (móvil).
