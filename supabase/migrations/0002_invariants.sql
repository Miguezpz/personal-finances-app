-- =============================================================================
-- 0002 · Invariants (T020): exact sums (deferred constraint triggers) + idempotency keys.
-- The checker functions are called from BOTH sides of each relation (header and detail), so
-- neither an income without allocations nor an UPDATE of the amount can bypass validation.
-- Error code 23514 (check_violation) maps to ProviderError('VALIDATION') in the client.
--
-- Privileges: the TRIGGER functions are SECURITY DEFINER (owner `postgres`, which has BYPASSRLS)
-- so validation sees the rows it checks no matter which role fires the write — the app user,
-- GoTrue's supabase_auth_admin when an account is deleted (cascade), or the dashboard. The
-- check_* helpers are executable only by the owner (0005), so they can't be called through the
-- API to probe other users' amounts. Trigger functions can't be invoked via RPC at all.
-- =============================================================================

-- ---------- Incomes: Σ allocations = amount when distributed -----------------
create function public.check_income_allocations(p_income uuid) returns void
language plpgsql
set search_path = ''
as $$
declare v_total bigint; v_dist boolean; v_sum bigint;
begin
  select amount_cents, distributed into v_total, v_dist from public.incomes where id = p_income;
  if not found then return; end if;                          -- income deleted in cascade
  select coalesce(sum(amount_cents), 0) into v_sum from public.income_allocations where income_id = p_income;
  if v_dist and v_sum <> v_total then
    raise exception 'allocations sum % <> income amount %', v_sum, v_total using errcode = '23514';
  end if;
  if not v_dist and v_sum <> 0 then
    raise exception 'income not distributed must have no allocations' using errcode = '23514';
  end if;
end $$;

create function public.trg_allocations_sum_fn() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.check_income_allocations(old.income_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.check_income_allocations(new.income_id); end if;
  return null;
end $$;
create constraint trigger trg_allocations_sum
  after insert or update or delete on public.income_allocations
  deferrable initially deferred for each row execute function public.trg_allocations_sum_fn();

create function public.trg_income_total_fn() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_income_allocations(new.id);
  return null;
end $$;
create constraint trigger trg_income_total
  after insert or update of amount_cents, distributed on public.incomes
  deferrable initially deferred for each row execute function public.trg_income_total_fn();

-- ---------- Receivables: Σ installments = total and count = term_months -------
create function public.check_receivable_installments(p_receivable uuid) returns void
language plpgsql
set search_path = ''
as $$
declare v_total bigint; v_n smallint; v_sum bigint; v_count integer;
begin
  select total_cents, term_months into v_total, v_n from public.receivables where id = p_receivable;
  if not found then return; end if;
  select coalesce(sum(amount_cents), 0), count(*) into v_sum, v_count
    from public.installments where receivable_id = p_receivable;
  if v_sum <> v_total then
    raise exception 'installments sum % <> receivable total %', v_sum, v_total using errcode = '23514';
  end if;
  if v_count <> v_n then
    raise exception 'installments count % <> term_months %', v_count, v_n using errcode = '23514';
  end if;
end $$;

create function public.trg_installments_sum_fn() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.check_receivable_installments(old.receivable_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.check_receivable_installments(new.receivable_id); end if;
  return null;
end $$;
create constraint trigger trg_installments_sum
  after insert or update or delete on public.installments
  deferrable initially deferred for each row execute function public.trg_installments_sum_fn();

create function public.trg_receivable_total_fn() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_receivable_installments(new.id);
  return null;
end $$;
create constraint trigger trg_receivable_total
  after insert or update of total_cents, term_months on public.receivables
  deferrable initially deferred for each row execute function public.trg_receivable_total_fn();

-- ---------- Distribution rules: Σ investment sub-rules = 10000 ----------------
create function public.check_rule_subrules(p_rule uuid) returns void
language plpgsql
set search_path = ''
as $$
declare v_inv smallint; v_sum integer;
begin
  select investment_bps into v_inv from public.distribution_rules where id = p_rule;
  if not found then return; end if;
  select coalesce(sum(pct_bps), 0) into v_sum from public.investment_subrules where rule_id = p_rule;
  if v_inv > 0 and v_sum <> 10000 then
    raise exception 'investment sub-rules must sum to 10000 bps (got %)', v_sum using errcode = '23514';
  end if;
  if v_inv = 0 and v_sum <> 0 then
    raise exception 'sub-rules require investment_bps > 0' using errcode = '23514';
  end if;
end $$;

-- Detail side (contract name: assert_subrules_sum).
create function public.assert_subrules_sum() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.check_rule_subrules(old.rule_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.check_rule_subrules(new.rule_id); end if;
  return null;
end $$;
create constraint trigger trg_subrules_sum
  after insert or update or delete on public.investment_subrules
  deferrable initially deferred for each row execute function public.assert_subrules_sum();

-- Header side (added): a rule with investment_bps > 0 and no sub-rules, or a later change of
-- investment_bps, is also rejected — same "both sides" pattern as incomes and receivables.
create function public.trg_rule_investment_fn() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_rule_subrules(new.id);
  return null;
end $$;
create constraint trigger trg_rule_investment
  after insert or update of investment_bps on public.distribution_rules
  deferrable initially deferred for each row execute function public.trg_rule_investment_fn();

-- ---------- Idempotency keys -------------------------------------------------
-- Deviation 3: full UNIQUE constraints instead of the contract's partial unique index
-- (`... where recurring_expense_id is not null`). PostgREST's upsert sends
-- `ON CONFLICT (cols)` without a predicate, which cannot infer a partial index. Semantics are
-- identical: NULLs are distinct in Postgres, so manual expenses never collide.
alter table public.expenses
  add constraint expenses_recurring_occurrence_uq unique (recurring_expense_id, occurrence_date);

alter table public.goal_contributions
  add constraint goal_contributions_goal_period_uq unique (goal_id, period_start);
