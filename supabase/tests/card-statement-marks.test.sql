-- =============================================================================
-- Spec 011 (T011): card_statement_marks — RLS isolation, uniqueness per cut-off, and the legacy
-- conversion rule private.legacy_statement_cut_off (same cases as legacy-card-payments.test.ts).
-- Run: pnpm db:test
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select has_table('public', 'card_statement_marks', 'card_statement_marks exists');
select table_privs_are('public', 'card_statement_marks', 'anon', array[]::text[], 'anon has no privileges');
select table_privs_are('public', 'card_statement_marks', 'authenticated',
  array['SELECT', 'INSERT', 'DELETE'], 'authenticated can select, insert and delete (no update)');

-- ---------- Conversion rule ---------------------------------------------------------------
select is(private.legacy_statement_cut_off(10, '2026-11-12'), '2026-11-10'::date, 'paid after the cut-off → that statement');
select is(private.legacy_statement_cut_off(10, '2026-11-10'), '2026-10-10'::date, 'paid on the cut-off day → the previous statement');
select is(private.legacy_statement_cut_off(10, '2026-11-30'), '2026-11-10'::date, 'paid on the due date');
select is(private.legacy_statement_cut_off(31, '2026-03-05'), '2026-02-28'::date, 'cut-off on the 31st → Feb 28');
select is(private.legacy_statement_cut_off(10, '2027-01-01'), '2026-12-10'::date, 'crosses the year');

-- ---------- Fixtures ----------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('b1100000-0000-0000-0000-000000000001', 'marks@test.local', 'authenticated', 'authenticated'),
  ('b1100000-0000-0000-0000-000000000002', 'intruder@test.local', 'authenticated', 'authenticated');
insert into accounts (id, user_id, kind, name, cut_off_day, payment_due_offset_days) values
  ('ac110000-0000-0000-0000-000000000001', 'b1100000-0000-0000-0000-000000000001',
   'credit_card', 'Nu', 10, 20);

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

-- ---------- Owner: mark, uniqueness, unmark -------------------------------------------------
select pg_temp.as_user('b1100000-0000-0000-0000-000000000001');
insert into card_statement_marks (card_account_id, cut_off)
values ('ac110000-0000-0000-0000-000000000001', '2026-11-10');
select throws_ok($$
  insert into card_statement_marks (card_account_id, cut_off)
  values ('ac110000-0000-0000-0000-000000000001', '2026-11-10')
$$, '23505', null, 'one mark per card and cut-off');
select lives_ok($$
  insert into card_statement_marks (card_account_id, cut_off)
  values ('ac110000-0000-0000-0000-000000000001', '2026-11-10')
  on conflict (user_id, card_account_id, cut_off) do nothing
$$, 'marking again with on conflict is a no-op');
select is((select count(*)::int from card_statement_marks), 1, 'the owner sees one mark');

-- ---------- Intruder: can't see, mark or remove ---------------------------------------------
select pg_temp.as_user('b1100000-0000-0000-0000-000000000002');
select is((select count(*)::int from card_statement_marks), 0, 'another user sees no marks');
select throws_ok($$
  insert into card_statement_marks (card_account_id, cut_off)
  values ('ac110000-0000-0000-0000-000000000001', '2026-10-10')
$$, '23503', null, 'another user cannot mark someone else''s card (composite FK)');
delete from card_statement_marks;
select pg_temp.as_user('b1100000-0000-0000-0000-000000000001');
select is((select count(*)::int from card_statement_marks), 1, 'another user cannot delete the owner''s marks');

delete from card_statement_marks where cut_off = '2026-11-10';
select is((select count(*)::int from card_statement_marks), 0, 'the owner can unmark');

select * from finish();
rollback;
