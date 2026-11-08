# Data Model: Flujos y formularios con menos fricción

Sin cambios de esquema. Estado de cliente:

## LastUsed (persistido en el dispositivo, `pfa:prefs:v1`)
| Campo | Tipo | Se actualiza al guardar con éxito |
|---|---|---|
| paymentAccountId | Uuid \| null | gasto (cuenta de pago) y gasto fijo |
| subcategoryId | Uuid \| null | gasto y gasto fijo |
| depositAccountId | Uuid \| null | ingreso |
| sourceAccountId | Uuid \| null | pago de tarjeta (cuenta de origen) |

Validación: se ignora si la cuenta no existe o está archivada, o si la subcategoría no existe o está archivada.

## PendingDelete (memoria)
`{ key: "${kind}:${id}", kind: "expense"|"income"|"card-payment"|"recurring", id, apply(snapshot) → snapshot, timer }`.
Transiciones: encolado → (Deshacer) descartado | (6 s / pagehide) confirmado → (error) revertido.

## CreateDialog (ampliado)
- `expense`: `+ draft?: Partial<ExpenseFormInput>`
- `income`: `+ draft?: Partial<IncomeFormInput>`
- `receivable` (nuevo): `{ kind: "receivable"; draft?: Partial<ReceivableFormInput> }`

## Filtros en la URL
- Gastos: `periodo` (PeriodKey válido), `bucket` (`needs` | `wants`), `metodo` (uuid | `none`).
- Bitácora: `desde`, `hasta` (IsoDate), `tipo` (LedgerEntryType), `categoria`, `cuenta` (uuid), `terceros` (`all` | `only` | `hide`), `q` (texto ≤ 100 caracteres), `preset` (`this-period` | `last-period` | `this-month` | `last-month`).
