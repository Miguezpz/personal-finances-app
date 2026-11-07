-- Spec 007 · Card terms + MSI rescheduling in one transaction (FR-011, FR-012, research.md R6).
--
-- The client computes the new dates (business-day rule, Principle V); this function only applies
-- them and checks who they belong to. No tables or columns change.
--
--   p_patch         account columns in snake_case (as `fromAccount` builds them); missing keys keep
--                   their value. Only the editable columns are applied.
--   p_installments  [{ id, due_on, card_due_on }]: each must be an installment of a purchase made
--                   with card p_id that is not fully collected; otherwise nothing changes (23514).
--
-- SECURITY INVOKER: RLS applies, so another user's card does not exist for the caller (P0002).

create function public.update_account_with_installments(
  p_id uuid,
  p_patch jsonb,
  p_installments jsonb
)
returns public.accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row      accounts;
  v_new      accounts;
  v_expected integer := jsonb_array_length(coalesce(p_installments, '[]'::jsonb));
  v_updated  integer;
begin
  select * into v_row from accounts where id = p_id for update;
  if not found then
    raise exception 'account % not found', p_id using errcode = 'P0002';      -- → NOT_FOUND
  end if;

  if coalesce(p_patch, '{}'::jsonb) <> '{}'::jsonb then
    v_new := jsonb_populate_record(v_row, p_patch);
    update accounts
       set kind                    = v_new.kind,
           name                    = v_new.name,
           institution             = v_new.institution,
           cut_off_day             = v_new.cut_off_day,
           payment_due_offset_days = v_new.payment_due_offset_days,
           opening_balance_cents   = v_new.opening_balance_cents,
           archived_at             = v_new.archived_at
     where id = p_id
    returning * into v_row;
  end if;

  if v_expected > 0 then
    with input as (
      select (i ->> 'id')::uuid          as id,
             (i ->> 'due_on')::date      as due_on,
             (i ->> 'card_due_on')::date as card_due_on
        from jsonb_array_elements(p_installments) as i
    )
    update installments n
       set due_on = input.due_on,
           card_due_on = input.card_due_on
      from input, receivables r
     where n.id = input.id
       and r.id = n.receivable_id
       and r.user_id = n.user_id
       and r.card_account_id = p_id
       and n.status <> 'collected';
    get diagnostics v_updated = row_count;

    if v_updated <> v_expected then
      raise exception 'only % of % installments belong to card % and are not collected',
        v_updated, v_expected, p_id using errcode = '23514';                  -- → VALIDATION
    end if;
  end if;

  return v_row;
end $$;

revoke execute on function public.update_account_with_installments(uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_account_with_installments(uuid, jsonb, jsonb)
  to authenticated;
