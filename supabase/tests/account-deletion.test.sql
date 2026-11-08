-- =============================================================================
-- Deleting a user in Auth (account deletion, or from the dashboard) must cascade cleanly
-- through every table, deferred sum triggers included.
-- GoTrue runs `DELETE /admin/users/:id` as supabase_auth_admin; the test role can't SET ROLE to
-- it locally, so that exact path is exercised end-to-end by the contract test's cleanup
-- (tests/contract/supabase.contract.test.ts). Here: the cascade itself and the privileges that
-- make it work for any role.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, aud, role)
values ('cccccccc-0000-0000-0000-000000000003', 'leaving@test.local', 'authenticated', 'authenticated');

-- A full data set, one row per table, created as the user.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);

insert into user_settings default values;
insert into accounts (id, kind, name) values ('a1000000-0000-0000-0000-000000000001', 'investment', 'Stocks');
insert into accounts (id, kind, name, cut_off_day, payment_due_offset_days)
values ('a3000000-0000-0000-0000-000000000003', 'credit_card', 'Card', 10, 20);
insert into categories (id, name, macro) values ('c0000000-0000-0000-0000-00000000000c', 'Home', 'needs');
insert into subcategories (id, category_id, name)
values ('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c', 'Rent');
select save_distribution_rule(
  '{"effective_from":"2026-11-01","needs_bps":5000,"wants_bps":3000,"investment_bps":2000}',
  '[{"account_id":"a1000000-0000-0000-0000-000000000001","pct_bps":10000}]');
select register_income(
  jsonb_build_object('label','Salary','amount_cents',1000,'received_on','2026-11-15','funded_period_start','2026-11-16',
    'rule_id',(select id from distribution_rules)),
  '[{"bucket":"needs","amount_cents":500,"period_start":"2026-11-16"},
    {"bucket":"wants","amount_cents":300,"period_start":"2026-11-16"},
    {"bucket":"investment","account_id":"a1000000-0000-0000-0000-000000000001","amount_cents":200,"period_start":"2026-11-16"}]');
insert into recurring_expenses (id, name, amount_cents, charge_day, subcategory_id, bucket, starts_on)
values ('e0000000-0000-0000-0000-00000000000e', 'Rent', 800000, 1, '50000000-0000-0000-0000-000000000005', 'needs', '2026-11-01');
insert into expenses (amount_cents, spent_on, subcategory_id, bucket, origin, recurring_expense_id, occurrence_date)
values (800000, '2026-11-01', '50000000-0000-0000-0000-000000000005', 'needs', 'recurring',
        'e0000000-0000-0000-0000-00000000000e', '2026-11-01');
insert into card_payments (card_account_id, amount_cents, paid_on) values ('a3000000-0000-0000-0000-000000000003', 100, '2026-11-20');
insert into card_statement_marks (card_account_id, cut_off) values ('a3000000-0000-0000-0000-000000000003', '2026-11-10');
insert into debtors (id, name) values ('d0000000-0000-0000-0000-00000000000d', 'Ana');
select create_receivable(
  '{"debtor_id":"d0000000-0000-0000-0000-00000000000d","card_account_id":"a3000000-0000-0000-0000-000000000003",
    "description":"Phone","total_cents":1000,"term_months":1,"purchase_date":"2026-11-05"}',
  '[{"seq":1,"due_on":"2026-11-27","card_due_on":"2026-11-30","amount_cents":1000}]');
insert into goals (id, kind, name, source_bucket, annual_cents, monthly_cents)
values ('90000000-0000-0000-0000-000000000009', 'sinking_fund', 'Tax', 'needs', 1200, 100);
insert into goal_contributions (goal_id, period_start, amount_cents, source_bucket)
values ('90000000-0000-0000-0000-000000000009', '2026-11-01', 100, 'needs');
insert into net_worth_snapshots (snapshot_on, assets_cents, liabilities_cents) values ('2026-11-01', 10, 0);
insert into expense_templates (name, amount_cents, subcategory_id, payment_account_id)
values ('Transport', 2400, '50000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000003');

set constraints all immediate;   -- the data set itself is valid
set constraints all deferred;

-- The sum triggers validate as the table owner, whoever fires them.
reset role;
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype and p.prosecdef
      and p.proname in ('trg_allocations_sum_fn','trg_income_total_fn','trg_installments_sum_fn',
                        'trg_receivable_total_fn','assert_subrules_sum','trg_rule_investment_fn')),
  6, 'the 6 sum trigger functions are SECURITY DEFINER');
select ok(not has_function_privilege(r, 'public.check_income_allocations(uuid)', 'execute')
       and not has_function_privilege(r, 'public.check_receivable_installments(uuid)', 'execute')
       and not has_function_privilege(r, 'public.check_rule_subrules(uuid)', 'execute'),
          'check_* helpers are not executable by ' || r)
  from unnest(array['anon','authenticated','supabase_auth_admin']) as r;

-- Delete the user, then fire the deferred checks as COMMIT would.
select lives_ok($$
  delete from auth.users where id = 'cccccccc-0000-0000-0000-000000000003';
  set constraints all immediate;
$$, 'deleting the user cascades through every table');

reset role;
select is(
  (select sum(n)::int from (
     select count(*) as n from public.user_settings      where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.accounts           where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.distribution_rules where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.investment_subrules where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.categories         where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.subcategories      where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.incomes            where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.income_allocations where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.recurring_expenses where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.expenses           where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.card_payments      where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.debtors            where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.receivables        where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.installments       where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.goals              where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.goal_contributions where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.net_worth_snapshots where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.expense_templates  where user_id = 'cccccccc-0000-0000-0000-000000000003' union all
     select count(*) from public.card_statement_marks where user_id = 'cccccccc-0000-0000-0000-000000000003') t),
  0,
  'no row of the deleted user remains in any of the 19 tables'
);

select * from finish();
rollback;
