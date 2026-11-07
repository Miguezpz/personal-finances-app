# Contract delta: DataProvider (spec 007)

Cambios sobre `src/data/provider.ts`. Los cumplen los dos proveedores (Supabase y mock) y el `MemoryProvider` de pruebas (`tests/utils/memory-provider.ts`). La suite compartida `tests/contract/data-provider.contract.ts` los verifica contra ambos.

```ts
// Dominio (data-model.md)
interface InstallmentDates { id: Uuid; dueOn: IsoDate; cardDueOn: IsoDate }

// AccountsRepository: update gana un argumento opcional
update(
  id: Uuid,
  patch: Patch<Account>,
  /** Mensualidades a reprogramar en la MISMA transacción (RPC). Vacío u omitido → update directo. */
  reschedule?: readonly InstallmentDates[],
): Promise<Account>;
```

Nada más cambia. `receivables.list()` ya devuelve las mensualidades con sus fechas nuevas.

## RPC (migración `supabase/migrations/0010_update_card_terms.sql`)

```text
public.update_account_with_installments(p_id uuid, p_patch jsonb, p_installments jsonb)
  returns public.accounts
  language plpgsql  security invoker  set search_path = public
```

1. `p_patch` usa las llaves en snake_case que produce `fromAccount`.
   - Se aplica sobre la fila actual con `jsonb_populate_record`.
   - Las llaves ausentes no cambian.
   - Si la cuenta no existe, o RLS no la deja ver, lanza `P0002` → `ProviderError('NOT_FOUND')`.
2. `p_installments` es un arreglo de `{ id, due_on, card_due_on }`.
   - Cada elemento actualiza una mensualidad que (a) pertenezca a una compra con `card_account_id = p_id` y (b) tenga `status <> 'collected'`.
   - Si se actualizan menos filas que elementos tiene el arreglo, lanza `23514` y todo se revierte → `ProviderError('VALIDATION')`.
3. `grant execute` a `authenticated`; `revoke` a `public` y `anon`. Es el mismo patrón que `create_receivable`.

## Casos de contrato nuevos

| # | Caso | Resultado esperado |
|---|---|---|
| C1 | `update(card, { cutOffDay: 14, paymentDueOffsetDays: 21 }, [{ id: pending, dueOn, cardDueOn }])` | Devuelve la cuenta con los términos nuevos; `receivables.list()` trae la mensualidad con las fechas nuevas |
| C2 | Igual que C1, incluyendo una mensualidad `collected` | Rechaza con `VALIDATION`; ni la cuenta ni ninguna mensualidad cambia |
| C3 | Igual que C1, con la mensualidad de **otra** tarjeta | Rechaza con `VALIDATION`; nada cambia |
| C4 | `update(card, {}, [cambios])` (pasada del `BackgroundSync`) | Solo cambian las mensualidades; la cuenta queda igual |
| C5 | `update(card, { name: "X" })` sin `reschedule` | Igual que hoy; las mensualidades no cambian |
| C6 | `update(idInexistente, {...}, [..])` | Rechaza con `NOT_FOUND` |
| C7 | Mock de demo: `update(..., reschedule)` | Rechaza con `DemoReadOnlyError`; nada cambia |

En el mock y en el `MemoryProvider`, C2 y C3 replican las validaciones de la RPC, para que todos los proveedores se comporten igual.

## SQL (pgTAP, `supabase/tests/card-terms.test.sql`, nuevo)

- C1–C3 a nivel SQL, incluida la reversión completa en C2 y C3.
- Un usuario B no puede reprogramar mensualidades de A: la función es `security invoker` y RLS aplica, así que la cuenta de A no existe para B (`P0002`).
- `anon` no puede ejecutar la función.
