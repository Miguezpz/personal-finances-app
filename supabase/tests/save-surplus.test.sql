-- =============================================================================
-- Spec 013 (T002): user_settings.save_surplus — boolean, not null, default false; owner-only
-- through the table's RLS (contracts/data.md).
-- Run: pnpm db:test
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select has_column('public', 'user_settings', 'save_surplus', 'save_surplus exists');
select col_type_is('public', 'user_settings', 'save_surplus', 'boolean', 'it is boolean');
select col_not_null('public', 'user_settings', 'save_surplus', 'it is not null');
select col_default_is('public', 'user_settings', 'save_surplus', 'false', 'it defaults to false');

insert into auth.users (id, email, aud, role) values
  ('a1300000-0000-0000-0000-000000000001', 'saver@test.local', 'authenticated', 'authenticated'),
  ('a1300000-0000-0000-0000-000000000002', 'intruder@test.local', 'authenticated', 'authenticated');

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.as_user('a1300000-0000-0000-0000-000000000001');
insert into user_settings default values;
select is((select save_surplus from user_settings), false, 'a new user reads false');

update user_settings set save_surplus = true;
select is((select save_surplus from user_settings), true, 'the owner can turn it on');

select pg_temp.as_user('a1300000-0000-0000-0000-000000000002');
select is_empty($$ select 1 from user_settings $$, 'another user cannot see it (RLS)');
update user_settings set save_surplus = false;

reset role;
select is(
  (select save_surplus from user_settings where user_id = 'a1300000-0000-0000-0000-000000000001'),
  true, 'the other user changed nothing');

select * from finish();
rollback;
