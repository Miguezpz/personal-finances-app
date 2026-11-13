# Contract: dominio y UI

## `src/domain/goals.ts` (funciones puras, pruebas primero)

```ts
/** Lo que la meta tiene neto desde Ahorrado (asignado − regresado). */
export function netFromSaved(goalId: Uuid, moves: readonly SavedMove[]): Cents;

/** FR-001/002: el valor real puede ser negativo; la UI muestra max(·, 0) y `over`. */
export function availableToAssign(
  savedTotal: Cents,
  moves: readonly SavedMove[],
): { available: Cents; over: boolean };

/** FR-007: barra con tope 1; `saved` es el neto real (puede pasar el objetivo). */
export function purchaseProgress(goal: Goal, moves: readonly SavedMove[]): {
  saved: Cents;
  target: Cents;
  ratio: number; // 0..1
};
```

- `emergencyFundProgress(goal, contributions, expenses, today, moves = [])`: `saved` suma el neto.
- `dueContributions`: sin cambio de firma; una Compra nunca genera aportaciones (`monthly` es `null`).

Casos mínimos:
- `available`: $2,327.90 − $1,000 = $1,327.90; con un regreso de $2,000 sube $2,000; total menor que lo asignado ⇒ `over: true`.
- Neto con asignaciones y regresos de varias metas solo cuenta la suya.
- Compra $25,000 con $5,000 ⇒ `ratio 0.2`; con $30,000 ⇒ `ratio 1`, `saved 30,000`.
- Fondo de emergencia con $10,000 aportados + $1,000 asignados ⇒ `saved 11,000`.

## `src/domain/net-worth.ts`

`assets += sts.saved.total − Σ netFromSaved(g) de metas con completed`.

Pruebas:
- Patrimonio igual antes/después de una asignación y de un regreso.
- Al cumplir una Compra con $5,000 netos baja exactamente $5,000; al restaurar vuelve.
- `safe-to-spend` igual con y sin movimientos.

## `src/features/goals/schemas.ts`

- `GOAL_KINDS` gana `purchase`; `DEFAULT_SOURCE_BUCKET.purchase = "investment"` (no se muestra).
- `goalFormSchema`: campos `target` y `targetMonth`; para `purchase` exige `target > 0`, valida `YYYY-MM` o vacío, y devuelve `monthly: null`.
- `makeSavedMoveSchema(max: Cents)`: `{ goalId, amount }`; monto > 0 y ≤ `max`; el error lleva el máximo.

## Hooks (`src/features/goals/hooks.ts`)

- `useGoalData` devuelve también `savedMoves`.
- `useAddSavedMove()`: `useSnapshotMutation`, optimista sobre `savedMoves`, `replaceTemp` al confirmar.
- Restaurar una cumplida usa `useUpdateGoal` con `{ archived: false, completed: false }`.

## UI

| Componente | Cambio |
| ---------- | ------ |
| `SavedCard` | fila "Disponible para asignar" (`data-testid="saved-available"`), aviso si `over`, botón "Asignar" que abre `SavedMoveDialog` |
| `SavedMoveDialog` (nuevo, `features/goals`) | `mode: "assign" \| "return"`, `goal?`; selector de meta si no viene; muestra el máximo; toast al guardar |
| `GoalForm` | tipo Compra: nombre, objetivo, mes (`type="month"`); sin bucket ni mensualidad |
| `GoalsPage` | tarjetas Compra (barra, "$X de $Y", mes/año), botones Asignar / Regresar / Lo compré, badge "Cumplida"; Fondo y Apartado suman el neto |
| `domain-icons.ts` | `GOAL_KIND_ICONS.purchase` (Lucide `ShoppingBag`) |
| `Dashboard` | pasa a `SavedCard` los movimientos y metas que necesita |

Reglas de visibilidad: research R10. Todo monto va con `<Money>` (privacidad y divisa, FR-015).

## i18n (`src/i18n/messages/{en,es}.json`)

EN obligatorios (US6-3): "Purchase", "Assign", "Available to assign", "Return to Saved", "I bought it". ES: "Compra", "Asignar", "Disponible para asignar", "Regresar a Ahorrado", "Lo compré". Más: "Completed"/"Cumplida", aviso de sobre-asignación, máximo permitido, toasts y etiquetas del formulario. Paridad EN/ES la cubre la prueba existente.
