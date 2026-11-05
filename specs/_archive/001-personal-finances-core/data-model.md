# Data Model: Personal Finances Core

**Feature**: 001-personal-finances-core | **Date**: 2026-10-31

Esquema SQL completo y políticas RLS en [contracts/db-schema.sql](./contracts/db-schema.sql); tipos TS en [contracts/domain-types.ts](./contracts/domain-types.ts).
Convenciones: dinero en **centavos MXN** (`bigint`/`Cents`), porcentajes en **bps** (0–10000), fechas `date`, toda tabla con `user_id` + RLS.

## Diagrama de relaciones

```text
auth.users 1─1 user_settings
auth.users 1─* accounts ◄──────────────────────────────────────────────┐
                │  (kind: checking|savings|credit_card|investment|cash)│
distribution_rules 1─* investment_subrules ──► accounts(investment)    │
categories(macro) 1─* subcategories                                    │
incomes 1─* income_allocations ──► accounts(investment)                │
recurring_expenses ─► subcategories, accounts                          │
expenses ─► subcategories, accounts, recurring_expenses(0..1)          │
card_payments ─► accounts(credit_card)                                 │
debtors 1─* receivables ─► accounts(credit_card)                       │
receivables 1─* installments                                           │
goals 1─* goal_contributions                                           │
net_worth_snapshots (1 por mes)                                        │
ledger_entries (vista) = incomes ∪ expenses ∪ card_payments ∪ installments cobradas
```

## Entidades

| Entidad (tabla) | Campos clave | Relaciones / unicidad |
|-----------------|--------------|-----------------------|
| **UserSettings** (`user_settings`) | timezone, first/second_payday, green/yellow_min_bps, collection_lead_days, emergency_fund_months | PK = user_id |
| **Account** (`accounts`) | kind, name, institution, cut_off_day*, payment_due_offset_days*, opening_balance_cents, archived_at | (*) obligatorios si `kind = credit_card`; `unique(user_id, name)` |
| **DistributionRule** (`distribution_rules`) | effective_from, needs/wants/investment_bps | `Σ = 10000`; `unique(user_id, effective_from)` |
| **InvestmentSubrule** (`investment_subrules`) | rule_id, account_id, pct_bps | `Σ pct = 10000` si `investment_bps > 0`, 0 si no (trigger diferido) |
| **Category** (`categories`) | name, name_key, macro (needs/wants) | padre; `unique(user_id, name)` |
| **Subcategory** (`subcategories`) | category_id, name, name_key | hereda macro de la categoría; `unique(category_id, name)` |
| **Income** (`incomes`) | label, amount_cents, received_on, funded_period_start, is_recurring, distributed, rule_id | `funded_period_start` ∈ {día 1, 16} |
| **IncomeAllocation** (`income_allocations`) | income_id, bucket, account_id?, amount_cents, period_start | `Σ amount = income.amount` si `distributed` (trigger diferido); `account_id` ⇔ `bucket = investment` |
| **RecurringExpense** (`recurring_expenses`) | name, amount_cents, charge_day, subcategory_id, bucket, starts_on, ended_on | `bucket` = instantánea de la categoría |
| **Expense** (`expenses`) | amount_cents, spent_on, subcategory_id, bucket, payment_account_id, origin, recurring_expense_id?, occurrence_date? | `unique(recurring_expense_id, occurrence_date)` (idempotencia) |
| **CardPayment** (`card_payments`) | card_account_id, from_account_id?, amount_cents, paid_on | liquidación de deuda; no afecta bolsas |
| **Debtor** (`debtors`) | name | `unique(user_id, name)` |
| **Receivable** (`receivables`) | debtor_id, card_account_id, description, total_cents, term_months, purchase_date | 1..N installments |
| **Installment** (`installments`) | seq, due_on, card_due_on, amount_cents, collected_cents, collected_on, status | `Σ amount = receivable.total` (trigger); `unique(receivable_id, seq)` |
| **Goal** (`goals`) | kind, name, source_bucket, target_months?, annual_cents?, monthly_cents? | emergencia ⇒ target_months; apartado ⇒ annual+monthly |
| **GoalContribution** (`goal_contributions`) | goal_id, period_start, amount_cents, source_bucket | `unique(goal_id, period_start)` |
| **NetWorthSnapshot** (`net_worth_snapshots`) | snapshot_on (día 1), assets_cents, liabilities_cents, net_worth_cents (generada) | `unique(user_id, snapshot_on)` |
| **LedgerEntry** (vista `ledger_entries`) | entry_type, occurred_on, amount_cents (con signo), description, bucket, is_third_party | `security_invoker = true` (respeta RLS) |

**No persistidos**: quincena (derivada de la fecha), saldo arrastrado, Safe-to-Spend, ocurrencias pendientes de fijos, alertas de cobro, estado de tarjeta, tasas de cambio (`FxSnapshot`, solo `localStorage`), preferencias de idioma/divisa/privacidad (solo `localStorage`).

## Reglas de validación (trazabilidad al spec)

| Regla | Aplicada en | FR |
|-------|-------------|----|
| Porcentajes de reparto suman exactamente 100% | `CHECK` en `distribution_rules` + validación Zod en el formulario | FR-001 |
| Sub-reglas de inversión suman 100% | trigger diferido + Zod | FR-002 |
| Asignaciones suman exactamente el ingreso (residuo al mayor %) | `allocateByWeights` + triggers diferidos sobre `income_allocations` **y** `incomes` (cubren ingresos sin asignaciones y cambios de monto) | FR-003/004, SC-001 |
| Cambios de reglas solo hacia adelante | `Income.rule_id` y asignaciones guardadas como instantánea; nueva fila de regla por `effective_from` | FR-005 |
| Ingreso financia la quincena que comienza con el pago | `fundedPeriodFor()`; `funded_period_start` guardado | FR-006 |
| Día de cargo inexistente → último día del mes | `clampChargeDay()` | FR-009 |
| Aplicación idempotente de fijos | índice único `(recurring_expense_id, occurrence_date)` | FR-010, SC-005 |
| Monto de gasto > 0 | `CHECK (amount_cents > 0)` + Zod | US4-3 |
| Gasto con tarjeta de crédito eleva su deuda; pago de tarjeta no toca bolsas | `cardStatus()` (deuda = compras + cargos de terceros − pagos) | FR-013a/b |
| Mensualidades suman el total (y su número = `term_months`); residuo en la última | `splitInstallments` + triggers diferidos sobre `installments` **y** `receivables` | FR-023, SC-006 |
| Fecha de cobro al deudor < límite de pago de la tarjeta | `buildCollectionSchedule`; `due_on = card_due_on − lead_days` | FR-024 |
| Cobros de terceros fuera del Safe-to-Spend y de las métricas personales | no son `Expense`; `LedgerEntry.isThirdParty = true` | FR-020, FR-026a, SC-007 |
| Tarjeta con MSI pendientes no se archiva | `AccountsRepository.archive` → `CONFLICT` | Edge case |
| Subcategoría con movimientos no se elimina sin reasignar | FK `ON DELETE RESTRICT` / `CONFLICT` | US8-4 |
| Sin imágenes ni archivos | no hay columnas binarias ni uso de Storage | FR-044 |
| Acceso solo del propietario | RLS + FKs compuestas `(user_id, id)` | FR-049 |

## Transiciones de estado

**Installment.status** (derivado de `collected_cents`, forzado por `CHECK`):

```text
pending ──(cobro parcial)──► partial ──(completa el monto)──► collected
   └───────────(cobro total)───────────────────────────────────► collected
collected ──(corrección del usuario: reduce collected_cents)──► partial | pending
```

**RecurringExpense**: `activo (ended_on NULL)` ⇄ `pausado/terminado (ended_on = fecha)`; las ocurrencias materializadas son inmutables respecto a los cambios del fijo (instantánea).

**Occurrence de fijo** (por quincena): `pendiente (virtual, fecha > hoy)` → `aplicada (fila en expenses, fecha ≤ hoy)`; el saldo disponible no cambia en la transición (FR-008a).

**Income**: `registrado sin repartir (distributed=false)` → `repartido` (se reemplaza con asignaciones en una operación atómica).

## Valores derivados (fórmulas)

Por bolsa `b ∈ {needs, wants}` y quincena `p`:

```text
closing(b, p)  = carry(b, p) + allocated(b, p) − fixedApplied(b, p) − manual(b, p) − goalContrib(b, p)
carry(b, p+1)  = closing(b, p)                                   // la primera quincena con datos arranca en 0
available(b, p)= carry(b, p) + allocated(b, p) − fixedApplied − fixedPending − manual − goalContrib
base(b, p)     = allocated(b, p) + max(carry(b, p), 0)      // el arrastre negativo NO aumenta la base (FR-017)
ratio          = available / base      (null si base ≤ 0)
light          = ratio ≥ green → verde | ratio ≥ yellow → amarillo | resto o available < 0 → rojo
                 (base ≤ 0 y available = 0 → neutral)
deuda total de tarjeta = Σ gastos con esa tarjeta + saldo completo de MSI a terceros (receivables) − Σ card_payments
pago sin intereses = Σ compras directas con fecha ≤ último corte
                     + Σ mensualidades de terceros con card_due_on = próximo límite de pago (NO las futuras)
                     − Σ pagos de tarjeta con fecha > último corte            (mínimo 0)
activos          = Σ opening_balance (cuentas que no son tarjeta) + Σ asignaciones a Inversión
                   + Σ aportaciones a metas con source_bucket needs|wants + Σ mensualidades de terceros pendientes
                   + saldo disponible actual de Needs y Wants (con signo)
patrimonio neto  = activos − Σ deuda total de tarjetas
gastos vitales   = promedio mensual de gastos aplicados en Needs de los últimos 3 meses completos (fondo de emergencia)
alertas de cobro = mensualidades no cobradas con due_on ≤ hoy + 7 días (ventana fija, COLLECTION_ALERT_WINDOW_DAYS)
```

- Excluye siempre `receivables`/`installments` de `manual` y `fixed*`.
- `goalContrib` solo resta cuando `source_bucket` coincide con la bolsa (needs/wants); las de `investment` no afectan el Safe-to-Spend.

## Volumen y límites (plan gratuito)

≈ 120 quincenas × (≈ 1 ingreso + 3–5 asignaciones + ≈ 40 gastos) ≈ 5–6 mil filas en 5 años ≈ < 5 MB, muy por debajo de los 500 MB de Supabase Free.
`loadSnapshot()` descarga todo en una carga; si superara ≈ 50 mil filas se paginaría por rango de fechas (los repositorios ya aceptan `range`).
