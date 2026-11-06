-- =============================================================================
-- T024 · RLS: a second user can't read, insert, update, delete or reference the first user's
-- rows (including through a composite FK), and anon has no access to anything.
-- Run: pnpm exec supabase test db
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- ---------- Fixtures (as postgres) ------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'intruder@test.local', 'authenticated', 'authenticated');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

-- ---------- RLS is enabled and forced on every table ------------------------
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relforcerowsecurity),
  18,
  'all 18 tables have RLS enabled and forced'
);
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'no table in public is exposed without RLS'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and policyname = tablename || '_owner'
      and roles = '{authenticated}' and cmd = 'ALL'),
  18,
  'every table has one owner policy for authenticated'
);

-- ---------- anon has no privileges on tables, the view or the RPCs ----------
select table_privs_are('public', t, 'anon', array[]::text[], 'anon has no privileges on ' || t)
  from unnest(array[
    'user_settings','accounts','distribution_rules','investment_subrules','categories','subcategories',
    'incomes','income_allocations','recurring_expenses','expenses','card_payments','debtors',
    'receivables','installments','goals','goal_contributions','net_worth_snapshots','expense_templates',
    'ledger_entries']) as t;

select function_privs_are('public', 'register_income', array['jsonb','jsonb'], 'anon', array[]::text[]);
select function_privs_are('public', 'replace_income', array['uuid','jsonb','jsonb'], 'anon', array[]::text[]);
select function_privs_are('public', 'create_receivable', array['jsonb','jsonb'], 'anon', array[]::text[]);
select function_privs_are('public', 'save_distribution_rule', array['jsonb','jsonb'], 'anon', array[]::text[]);

-- ---------- Owner creates data ----------------------------------------------
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');

select lives_ok($$
  insert into accounts (id, kind, name, cut_off_day, payment_due_offset_days)
  values ('a0000000-0000-0000-0000-00000000000a', 'credit_card', 'Owner card', 10, 20)
$$, 'owner creates an account');
select lives_ok($$
  insert into categories (id, name, macro) values ('c0000000-0000-0000-0000-00000000000c', 'Home', 'needs')
$$, 'owner creates a category');
select lives_ok($$
  insert into subcategories (id, category_id, name)
  values ('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c', 'Rent')
$$, 'owner creates a subcategory');
select lives_ok($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket, payment_account_id)
  values (50000, '2026-11-02', '50000000-0000-0000-0000-000000000005', 'needs', 'a0000000-0000-0000-0000-00000000000a')
$$, 'owner creates an expense');
select lives_ok($$ insert into user_settings default values $$, 'owner creates settings');
select lives_ok($$
  insert into expense_templates (id, name, amount_cents, subcategory_id, payment_account_id)
  values ('7e000000-0000-0000-0000-000000000007', 'Transport', 2400,
          '50000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-00000000000a')
$$, 'owner creates an expense template');

select is((select count(*)::int from ledger_entries), 1, 'owner sees its ledger entry');
select is((select user_id from accounts limit 1), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'user_id defaults to auth.uid()');

select results_eq(
  $$ with u as (update accounts set name = 'Owner card (renamed)' returning 1) select count(*)::int from u $$,
  array[1], 'owner can update its own rows (updated_at trigger runs as authenticated)');

-- ---------- Intruder sees nothing and can't touch anything ------------------
select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000002');

select is_empty('select * from accounts', 'intruder cannot read accounts');
select is_empty('select * from categories', 'intruder cannot read categories');
select is_empty('select * from subcategories', 'intruder cannot read subcategories');
select is_empty('select * from expenses', 'intruder cannot read expenses');
select is_empty('select * from user_settings', 'intruder cannot read settings');
select is_empty('select * from ledger_entries', 'intruder cannot read the ledger view');
select is_empty('select * from expense_templates', 'intruder cannot read expense templates');

select results_eq(
  $$ with u as (update accounts set name = 'hacked' returning 1) select count(*)::int from u $$,
  array[0], 'intruder updates 0 rows');
select results_eq(
  $$ with d as (delete from expenses returning 1) select count(*)::int from d $$,
  array[0], 'intruder deletes 0 rows');
select results_eq(
  $$ with u as (update expense_templates set amount_cents = 1 returning 1) select count(*)::int from u $$,
  array[0], 'intruder updates 0 expense templates');
select results_eq(
  $$ with d as (delete from expense_templates returning 1) select count(*)::int from d $$,
  array[0], 'intruder deletes 0 expense templates');
select throws_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id)
  values ('Stolen', 100, '50000000-0000-0000-0000-000000000005')
$$, '23503', null, 'intruder cannot reference another user''s subcategory from a template (composite FK)');

select throws_ok($$
  insert into accounts (user_id, kind, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'cash', 'Planted')
$$, '42501', null, 'intruder cannot insert rows owned by another user');

select throws_ok($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket)
  values (100, '2026-11-02', '50000000-0000-0000-0000-000000000005', 'needs')
$$, '23503', null, 'intruder cannot reference another user''s subcategory (composite FK)');

select throws_ok($$
  insert into card_payments (card_account_id, amount_cents, paid_on)
  values ('a0000000-0000-0000-0000-00000000000a', 100, '2026-11-02')
$$, '23503', null, 'intruder cannot reference another user''s card (composite FK)');

select throws_ok($$
  select register_income(
    '{"label":"x","amount_cents":100,"received_on":"2026-11-15","funded_period_start":"2026-11-16",
      "distributed":false,"deposit_account_id":"a0000000-0000-0000-0000-00000000000a"}'::jsonb,
    '[]'::jsonb)
$$, '23503', null, 'intruder cannot reference another user''s account through an RPC');

-- ---------- Owner's data is untouched ---------------------------------------
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000001');
select is((select name from accounts), 'Owner card (renamed)', 'owner data unchanged by the intruder');
select is((select count(*)::int from expenses), 1, 'owner expense still there');
select is((select amount_cents from expense_templates), 2400::bigint, 'owner template unchanged by the intruder');

-- ---------- anon: every read is denied --------------------------------------
select pg_temp.act_as_anon();
select throws_ok('select * from public.accounts', '42501', null, 'anon cannot select accounts');
select throws_ok('select * from public.ledger_entries', '42501', null, 'anon cannot select the ledger');
select throws_ok($$ select public.register_income('{}'::jsonb, '[]'::jsonb) $$, '42501', null,
  'anon cannot execute RPCs');

reset role;
select * from finish();
rollback;
