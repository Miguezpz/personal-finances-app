# Contract: datos del ajuste `saveSurplus`

## SQL — `supabase/migrations/0013_save_surplus.sql`

```sql
alter table public.user_settings
  add column save_surplus boolean not null default false;
comment on column public.user_settings.save_surplus is
  'Spec 013: true = the positive closing of each quincena goes to Saved instead of carrying over.';
```

pgTAP en `supabase/tests/save-surplus.test.sql`:
- `has_column`, `col_not_null` y `col_default_is(false)`.
- Un usuario nuevo lee `false`.
- El dueño puede actualizarla y otro usuario no puede verla (RLS de la tabla).

## DataProvider

No hay métodos nuevos. `settings.get()` devuelve `saveSurplus`, y `settings.update({ saveSurplus })` lo persiste en mock y en Supabase.

| Capa | Cambio |
| ---- | ------ |
| `database.types.ts` | `save_surplus: boolean` en `Row`; opcional en `Insert` y `Update` |
| `mappers.ts` | `toUserSettings`: `saveSurplus: r.save_surplus`; `fromSettings`: `save_surplus` si viene definido |
| `tests/contract/schemas.ts` | `saveSurplus: z.boolean()` |
| `data-provider.contract.ts` | ida y vuelta de `settings.update({ saveSurplus: true })` (mock y Supabase local); en el demo, rechazo de solo lectura |
| `csv.ts` | columna `save_surplus` en `settings.csv` |
