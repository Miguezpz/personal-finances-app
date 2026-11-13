# Contract: dominio y UI de Ahorrado

## `src/domain/safe-to-spend.ts`

```ts
export interface SafeToSpendInput {
  // …sin cambios, salvo:
  settings: Pick<UserSettings, "greenMinBps" | "yellowMinBps" | "saveSurplus">;
}

export interface SavedSummary {
  /** Σ needs+wants transferred when the previous quincena closed. */
  lastPeriod: Cents;
  /** Σ of every transfer up to the current quincena. */
  total: Cents;
}

export interface SafeToSpend {
  // …sin cambios, más:
  /** null when settings.saveSurplus is off (FR-006). */
  saved: SavedSummary | null;
}

/** Misma firma y significado que hoy: el cierre de cada quincena, antes de la transferencia. */
export function computeCarryChain(input, upTo): ReadonlyMap<PeriodKey, Record<SpendBucket, Cents>>;
```

Garantías:
- `saveSurplus = false` produce un resultado idéntico al actual, salvo `saved: null`.
- `saveSurplus = true` → `needs.carryIn ≤ 0` y `wants.carryIn ≤ 0`.
- `saved.total ≥ saved.lastPeriod ≥ 0`.

## `src/domain/net-worth.ts`

`assets += sts.needs.available + sts.wants.available + (sts.saved?.total ?? 0)`.

Invariante: `computeNetWorth(s con saveSurplus=true) === computeNetWorth(s con saveSurplus=false)`.

## UI

- **Preferencias**:
  - `Switch` con `id="pref-save-surplus"` y `data-testid="pref-save-surplus"`, debajo de los campos de días de pago.
  - Etiqueta `settings.saveSurplusLabel` y ayuda `settings.saveSurplusHint`.
- **Dashboard**:
  - `SavedCard` (`data-testid="saved-card"`) debajo de los buckets, solo si `data.saved`.
  - Filas `saved-last` y `saved-total`, cada una con `<Money>`.
  - Llaves: `dashboard.savedTitle`, `dashboard.savedLastPeriod`, `dashboard.savedTotal` y `dashboard.savedHint`.

| Llave | ES | EN |
| ----- | -- | -- |
| `settings.saveSurplusLabel` | Guardar el sobrante de cada quincena | Save each pay period's leftover |
| `settings.saveSurplusHint` | Lo que sobra al cerrar una quincena va a Ahorrado y no se suma a la siguiente. Los sobregiros se siguen restando. | What's left when a pay period ends goes to Saved instead of the next one. Overspending still carries over. |
| `dashboard.savedTitle` | Ahorrado | Saved |
| `dashboard.savedLastPeriod` | Quincena pasada | Last pay period |
| `dashboard.savedTotal` | Total ahorrado | Total saved |
| `dashboard.savedHint` | Lo que te sobró de quincenas anteriores; no se suma a lo disponible. | What you had left from past pay periods; not added to what you can spend. |
