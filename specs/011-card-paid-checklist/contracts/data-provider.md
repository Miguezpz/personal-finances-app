# Contract: proveedor de datos (spec 011)

## `DataProvider.statementMarks` (reemplaza a `cardPayments`)

```ts
export interface StatementMarksRepository {
  list(): Promise<StatementMark[]>;
  create(input: { cardAccountId: Uuid; cutOff: IsoDate }): Promise<StatementMark>;
  remove(id: Uuid): Promise<void>;
}
```

| Caso                                   | Mock (demo)                         | Supabase                                          |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `list()`                               | marcas del seed                      | todas las marcas del dueño (RLS)                  |
| `create` nuevo                         | `DemoReadOnlyError` (aviso global)   | inserta y devuelve la marca                        |
| `create` repetido (mismo corte)        | `DemoReadOnlyError`                  | idempotente: devuelve la marca existente           |
| `create` con tarjeta de otro usuario   | n/a                                  | error (FK compuesta + RLS)                         |
| `remove(id)`                           | `DemoReadOnlyError`                  | borra; id inexistente no falla                     |

**Suite de contrato** (`tests/contract/data-provider.contract.ts`): mismos casos contra el mock y Supabase local. Reemplaza los casos de `cardPayments`.

## Snapshot

- `loadSnapshot()` deja de pedir `card_payments` y pide `card_statement_marks`.
- `FinanceSnapshot.statementMarks` es la única fuente de las marcas.

## Migración `0011_card_statement_marks.sql`

1. `create table public.card_statement_marks` (data-model §1), con índice, RLS, políticas y grants.
2. Conversión de `card_payments` a marcas (R4), con `on conflict do nothing`.
3. Sin cambios a `card_payments` ni a la vista `ledger`.

**pgTAP** (`supabase/tests/card-statement-marks.test.sql`):

- Un usuario no ve ni borra las marcas de otro.
- No se puede marcar la tarjeta de otro usuario.
- La unicidad por corte funciona.
- La conversión asigna:
  - un pago el día 12 con corte el 10 al corte del 10;
  - un pago el mismo día del corte al corte del mes anterior;
  - un corte el 31 en febrero al último día de febrero;
  - dos pagos sobre un mismo corte a una sola marca.
- Al borrar la cuenta, se borran sus marcas.

**Aplicación a la nube**: primero se ejecuta `supabase/queries/preview-card-marks.sql` (solo lectura) y se le muestra al dueño. Después, con su aprobación, se aplica la migración y se regeneran `database.types.ts`.
