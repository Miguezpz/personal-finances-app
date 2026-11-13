-- =============================================================================
-- Spec 014 (T002): purchase goals and goal_saved_moves — shape CHECKs, RLS isolation,
-- insert-only privileges, and cascade on goal deletion.
-- Run: pnpm db:test
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select has_table('public', 'goal_saved_moves', 'goal_saved_moves exists');
select is((select relforcerowsecurity from pg_class where oid = 'public.goal_saved_moves'::regclass),
  true, 'RLS is forced');
select table_privs_are('public', 'goal_saved_moves', 'anon', array[]::text[], 'anon has no privileges');
select table_privs_are('public', 'goal_saved_moves', 'authenticated',
  array['SELECT', 'INSERT'], 'authenticated can only select and insert');

-- ---------- Fixtures ----------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('b1400000-0000-0000-0000-000000000001', 'saver@test.local', 'authenticated', 'authenticated'),
  ('b1400000-0000-0000-0000-000000000002', 'intruder@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

-- ---------- Purchase goal shape -------------------------------------------------------------
select pg_temp.as_user('b1400000-0000-0000-0000-000000000001');
select lives_ok($$
  insert into goals (id, kind, name, source_bucket, target_cents, due_month)
  values ('ab140000-0000-0000-0000-000000000001', 'purchase', 'Laptop', 'investment', 2500000, '2027-03-01')
$$, 'a purchase with a target and no monthly amount is valid');
select throws_ok($$
  insert into goals (kind, name, source_bucket, target_cents, monthly_cents)
  values ('purchase', 'Bad', 'investment', 2500000, 1000)
$$, '23514', null, 'a purchase cannot have monthly contributions');
select throws_ok($$
  insert into goals (kind, name, source_bucket) values ('purchase', 'Bad', 'investment')
$$, '23514', null, 'a purchase needs a target');
select throws_ok($$
  insert into goals (kind, name, source_bucket, target_cents, due_month)
  values ('purchase', 'Bad', 'investment', 100, '2027-03-15')
$$, '23514', null, 'the target month is the first day');
select throws_ok($$
  update goals set completed_at = now() where id = 'ab140000-0000-0000-0000-000000000001'
$$, '23514', null, 'completed requires archived');
select lives_ok($$
  insert into goals (id, kind, name, source_bucket, annual_cents, monthly_cents)
  values ('ab140000-0000-0000-0000-000000000002', 'sinking_fund', 'Tax', 'needs', 600000, 50000)
$$, 'a sinking fund is still valid');
select throws_ok($$
  update goals set archived_at = now(), completed_at = now()
   where id = 'ab140000-0000-0000-0000-000000000002'
$$, '23514', null, 'only a purchase can be completed');
select lives_ok($$
  update goals set archived_at = now(), completed_at = now()
   where id = 'ab140000-0000-0000-0000-000000000001'
$$, 'an archived purchase can be completed');
update goals set archived_at = null, completed_at = null where id = 'ab140000-0000-0000-0000-000000000001';

-- ---------- Moves ---------------------------------------------------------------------------
select lives_ok($$
  insert into goal_saved_moves (goal_id, moved_on, amount_cents) values
    ('ab140000-0000-0000-0000-000000000001', '2026-11-13', 500000),
    ('ab140000-0000-0000-0000-000000000001', '2026-11-13', -200000)
$$, 'the owner can assign and return');
select throws_ok($$
  insert into goal_saved_moves (goal_id, moved_on, amount_cents)
  values ('ab140000-0000-0000-0000-000000000001', '2026-11-13', 0)
$$, '23514', null, 'a zero move is rejected');
select is((select sum(amount_cents)::bigint from goal_saved_moves), 300000::bigint, 'net is the signed sum');

-- ---------- Intruder ------------------------------------------------------------------------
select pg_temp.as_user('b1400000-0000-0000-0000-000000000002');
select is((select count(*)::int from goal_saved_moves), 0, 'another user sees no moves');
select throws_ok($$
  insert into goal_saved_moves (goal_id, moved_on, amount_cents)
  values ('ab140000-0000-0000-0000-000000000001', '2026-11-13', 100)
$$, '23503', null, 'another user cannot move money into someone else''s goal (composite FK)');

-- ---------- Cascade -------------------------------------------------------------------------
reset role;
delete from goals where id = 'ab140000-0000-0000-0000-000000000001';
select is((select count(*)::int from goal_saved_moves
            where goal_id = 'ab140000-0000-0000-0000-000000000001'), 0,
  'deleting a goal deletes its moves');

select * from finish();
rollback;
