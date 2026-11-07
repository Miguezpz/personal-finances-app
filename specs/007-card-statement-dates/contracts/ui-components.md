# Contract: UI (spec 007)

## `AccountForm` → `CardTermsFields` (nuevo, `src/features/settings/accounts/CardTermsFields.tsx`)

Se muestra solo con `kind = credit_card`, en el lugar de los dos campos numéricos de hoy.

### Modo "statement" (por defecto)

- `#card-statement-cutoff` y `#card-statement-due`, ambos `<input type="date">`, con etiquetas "Fecha de corte" y "Fecha límite de pago".
- Prellenado:
  - al **editar**, con `latestStatement(terms, today)` (FR-005);
  - al **crear**, vacíos.
- Debajo, en una región `aria-live="polite"` con `data-testid="card-terms-summary"`:
  - El resumen derivado: "Corte el día {day} · vence {offset} días después".
  - Los **próximos 3 estados**, en una lista `data-testid="card-upcoming-statements"` con una fila por estado: "corte {fecha} → paga antes del {fecha}". Si la fecha se ajustó, un ícono y el texto "recorrido por día inhábil".
  - Los avisos, si los hay, en un `Alert` no bloqueante: `dueMayHaveMoved` y `shortMonthCutOff`.
- Si las fechas son inválidas, los errores salen en el campo de la fecha límite: `dueNotAfterCutOff` y `dueTooFar`.
- Botón de enlace "Capturar los números a mano" → modo manual.

### Modo "manual"

- Los campos de hoy, `#account-cutoff` y `#account-due`, con la misma validación.
- La vista previa de 3 estados también se muestra, calculada con los números.
- Enlace "Usar fechas del estado de cuenta" para volver.

### Esquema (`schema.ts`)

`accountFormSchema` gana estos campos:
- `termsMode: "statement" | "manual"`;
- `statementCutOffOn: string` y `statementDueOn: string` (ISO o vacío).

En modo statement, la transformación deriva `cutOffDay` y `paymentDueOffsetDays` con `cardTermsFromStatement`. La **salida** del esquema no cambia (`AccountFormOutput`), así que `useCreateAccount` y `useUpdateAccount` reciben lo mismo de hoy.

## `useUpdateAccount` (`src/features/settings/accounts/hooks.ts`)

- Si el patch cambia `cutOffDay` o `paymentDueOffsetDays`, calcula `rescheduleCardInstallments` con la cuenta resultante y lo pasa como tercer argumento de `accounts.update`.
- La parte optimista aplica el patch **y** las fechas de las mensualidades.
- Si falla, se revierte todo, como cualquier mutación de `useSnapshotMutation`.

## `useRescheduleInstallments` (nuevo, `src/features/receivables/useRescheduleInstallments.ts`)

`BackgroundSync` montado en `AppShell`, junto a `useMaterializeRecurring`.
- `plan`: la primera tarjeta activa con `rescheduleCardInstallments(...)` no vacío → `{ cardId, changes }`; si no hay ninguna, `null`.
- `write`: `accounts.update(cardId, {}, changes)` → devuelve el plan.
- `merge`: aplica `changes` a `installments`.

## i18n (`settings` en `en.json` y `es.json`, con paridad probada)

| Llave | es | en |
|---|---|---|
| `statementCutOff` | Fecha de corte | Statement date |
| `statementDue` | Fecha límite de pago | Payment due date |
| `statementHint` | Cópialas de cualquier estado de cuenta de la tarjeta. | Copy them from any statement of this card. |
| `upcomingStatements` | Próximos estados de cuenta | Upcoming statements |
| `statementRow` | Corte {cutOff} → paga antes del {due} | Closes {cutOff} → pay by {due} |
| `movedForHoliday` | recorrido por día inhábil | moved for a non-business day |
| `dueNotAfterCutOff` | La fecha límite debe ser después del corte. | The due date must be after the statement date. |
| `dueTooFar` | La fecha límite no puede ser más de 60 días después del corte. | The due date can't be more than 60 days after the statement date. |
| `dueMayHaveMoved` | Esta fecha límite pudo haberse recorrido por un fin de semana o día inhábil. Compara con otro estado de cuenta. | This due date may have been moved for a weekend or holiday. Compare with another statement. |
| `shortMonthCutOff` | El corte cayó en el último día de un mes corto; confirma tu día de corte con el estado de otro mes. | The statement closed on the last day of a short month; confirm the day with another month's statement. |
| `enterNumbers` | Capturar los números a mano | Enter the numbers manually |
| `useStatementDates` | Usar fechas del estado de cuenta | Use statement dates |

Las llaves de hoy (`cutOffDay`, `dueOffset`, `cardTerms`, `cardHint`) se conservan.

## Pruebas

- **Unit (`tests/unit/features/card-terms-fields.test.tsx`)**:
  - Capturar 22 nov / 7 dic muestra "día 22 · 15 días" y 3 estados.
  - Fechas inválidas muestran el error traducido.
  - Al editar BBVA se prellenan 5 nov / 25 nov.
  - El modo manual también muestra la vista previa.
- **Unit (`settings-schemas.test.ts`)**: los dos modos producen la misma salida.
- **E2E demo (`tests/e2e/us14-card-statement-dates.spec.ts`, `@demo`)**:
  - Abrir una tarjeta del demo y ver las fechas prellenadas y los 3 estados.
  - Guardar muestra el aviso de solo lectura.
  - axe sin violaciones serias en el diálogo.
- **E2E live (`@live`, mismo archivo)**:
  - Tarjeta con una compra MSI a 3 meses; cambiar el corte → las mensualidades no cobradas muestran fechas nuevas en Por cobrar.
