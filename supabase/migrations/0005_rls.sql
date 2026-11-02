-- =============================================================================
-- 0005 · Row Level Security (T023, Principle III). The repository is public: access control
-- relies on RLS, never on secrecy of the code.
--   * ENABLE + FORCE RLS on the 17 tables, one owner policy each with (select auth.uid())
--     (wrapped in a sub-select so the planner evaluates it once per statement).
--   * anon gets nothing: no table, view or function.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','accounts','distribution_rules','investment_subrules','categories','subcategories',
    'incomes','income_allocations','recurring_expenses','expenses','card_payments','debtors',
    'receivables','installments','goals','goal_contributions','net_worth_snapshots']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy %I on public.%I for all to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()))$p$, t || '_owner', t);
  end loop;
end $$;

revoke all on public.ledger_entries from anon, public;
grant select on public.ledger_entries to authenticated;

-- Functions are executable by PUBLIC by default. Lock all of them down, then grant only the
-- RPCs to the signed-in user. The check_* helpers stay owner-only: they are called from the
-- SECURITY DEFINER trigger functions (0002) and must not be reachable through the API.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.register_income(jsonb, jsonb),
  public.replace_income(uuid, jsonb, jsonb),
  public.create_receivable(jsonb, jsonb),
  public.save_distribution_rule(jsonb, jsonb)
to authenticated;

-- Future objects created in public by migrations must not leak to anon either.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
