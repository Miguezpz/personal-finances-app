-- =============================================================================
-- 0003 · Transactional RPCs (T021). SECURITY INVOKER: they run as the caller, so RLS applies.
-- They only insert header + detail atomically; amounts are computed by the client (src/domain)
-- and the deferred triggers of 0002 validate exact sums at COMMIT.
--
-- Added beyond the contract: replace_income — IncomesRepository.replace must be atomic and
-- PostgREST can't run several statements in one transaction without an RPC.
-- =============================================================================

create function public.register_income(p_income jsonb, p_allocations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  insert into incomes (label, amount_cents, received_on, funded_period_start, is_recurring, distributed, rule_id, deposit_account_id)
  values (p_income ->> 'label',
          (p_income ->> 'amount_cents')::bigint,
          (p_income ->> 'received_on')::date,
          (p_income ->> 'funded_period_start')::date,
          coalesce((p_income ->> 'is_recurring')::boolean, true),
          coalesce((p_income ->> 'distributed')::boolean, true),
          nullif(p_income ->> 'rule_id', '')::uuid,
          nullif(p_income ->> 'deposit_account_id', '')::uuid)
  returning id into v_id;

  insert into income_allocations (income_id, bucket, account_id, amount_cents, period_start)
  select v_id, (a ->> 'bucket')::bucket_kind, nullif(a ->> 'account_id', '')::uuid,
         (a ->> 'amount_cents')::bigint, (a ->> 'period_start')::date
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as a;

  return v_id;          -- the exact sum is validated at COMMIT (deferred trigger)
end $$;

create function public.replace_income(p_id uuid, p_income jsonb, p_allocations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  update incomes
     set label               = p_income ->> 'label',
         amount_cents        = (p_income ->> 'amount_cents')::bigint,
         received_on         = (p_income ->> 'received_on')::date,
         funded_period_start = (p_income ->> 'funded_period_start')::date,
         is_recurring        = coalesce((p_income ->> 'is_recurring')::boolean, true),
         distributed         = coalesce((p_income ->> 'distributed')::boolean, true),
         rule_id             = nullif(p_income ->> 'rule_id', '')::uuid,
         deposit_account_id  = nullif(p_income ->> 'deposit_account_id', '')::uuid
   where id = p_id;
  if not found then
    raise exception 'income % not found', p_id using errcode = 'P0002';   -- → NOT_FOUND
  end if;

  delete from income_allocations where income_id = p_id;
  insert into income_allocations (income_id, bucket, account_id, amount_cents, period_start)
  select p_id, (a ->> 'bucket')::bucket_kind, nullif(a ->> 'account_id', '')::uuid,
         (a ->> 'amount_cents')::bigint, (a ->> 'period_start')::date
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as a;

  return p_id;
end $$;

create function public.create_receivable(p_receivable jsonb, p_installments jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  insert into receivables (debtor_id, card_account_id, description, total_cents, term_months, purchase_date)
  values ((p_receivable ->> 'debtor_id')::uuid, (p_receivable ->> 'card_account_id')::uuid,
          p_receivable ->> 'description', (p_receivable ->> 'total_cents')::bigint,
          (p_receivable ->> 'term_months')::smallint, (p_receivable ->> 'purchase_date')::date)
  returning id into v_id;

  insert into installments (receivable_id, seq, due_on, card_due_on, amount_cents)
  select v_id, (i ->> 'seq')::smallint, (i ->> 'due_on')::date, (i ->> 'card_due_on')::date,
         (i ->> 'amount_cents')::bigint
  from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) as i;

  return v_id;          -- Σ and count are validated at COMMIT (deferred triggers)
end $$;

create function public.save_distribution_rule(p_rule jsonb, p_subrules jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  -- A rule already used by incomes is never rewritten (keeps the FR-005 snapshot).
  -- RLS limits both tables to the caller's own rows.
  if exists (select 1 from distribution_rules r
               join incomes i on i.rule_id = r.id and i.user_id = r.user_id
              where r.effective_from = (p_rule ->> 'effective_from')::date) then
    raise exception 'rule effective on % is already used by incomes; use a later effective_from',
      p_rule ->> 'effective_from' using errcode = '23505';                -- → CONFLICT
  end if;

  insert into distribution_rules (effective_from, needs_bps, wants_bps, investment_bps)
  values ((p_rule ->> 'effective_from')::date, (p_rule ->> 'needs_bps')::smallint,
          (p_rule ->> 'wants_bps')::smallint, (p_rule ->> 'investment_bps')::smallint)
  on conflict (user_id, effective_from) do update
    set needs_bps = excluded.needs_bps, wants_bps = excluded.wants_bps, investment_bps = excluded.investment_bps
  returning id into v_id;

  delete from investment_subrules where rule_id = v_id;
  insert into investment_subrules (rule_id, account_id, pct_bps)
  select v_id, (s ->> 'account_id')::uuid, (s ->> 'pct_bps')::smallint
  from jsonb_array_elements(coalesce(p_subrules, '[]'::jsonb)) as s;

  return v_id;
end $$;
