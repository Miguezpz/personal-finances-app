-- =============================================================================
-- Spec 004 (T004, T016): income_type, icon columns, income RPCs and the
-- private.apply_taxonomy_004 backfill (FR-003, FR-004, FR-006, FR-007, FR-011).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- ---------- Schema ----------------------------------------------------------
select enum_has_labels('public', 'income_type',
  array['salary','gift','debt_repayment','cashback','extra','sales','savings','investment_returns','other'],
  'income_type has the 9 fixed values in order');
select col_not_null('public', 'incomes', 'income_type', 'incomes.income_type is NOT NULL');
select col_default_is('public', 'incomes', 'income_type', 'other'::text, 'incomes.income_type defaults to other');
select col_is_null('public', 'categories', 'icon', 'categories.icon is nullable');
select col_is_null('public', 'subcategories', 'icon', 'subcategories.icon is nullable');

insert into auth.users (id, email, aud, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'icons@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'owner004@test.local', 'authenticated', 'authenticated');

-- ---------- Icon format check -----------------------------------------------
insert into categories (id, user_id, name, macro)
values ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Icon test', 'needs');

select lives_ok($$ update categories set icon = 'plug' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'icon accepts a short key');
select lives_ok($$ update categories set icon = 'gamepad-2' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'icon accepts digits and dashes');
select lives_ok($$ update categories set icon = null where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'icon accepts null');
select throws_ok($$ update categories set icon = 'Plug' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23514', null, 'icon rejects uppercase');
select throws_ok($$ update categories set icon = 'a b' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23514', null, 'icon rejects spaces');
select throws_ok($$ update categories set icon = '-x' where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23514', null, 'icon rejects a leading dash');
select throws_ok($$ update categories set icon = repeat('a', 41) where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  '23514', null, 'icon rejects more than 40 characters');

insert into subcategories (id, user_id, category_id, name)
values ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', 'Sub icon test');
select lives_ok($$ update subcategories set icon = 'coffee' where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  'subcategory icon accepts a short key');
select throws_ok($$ update subcategories set icon = 'Not Valid!' where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  '23514', null, 'subcategory icon rejects an invalid key');

-- ---------- Income RPCs -----------------------------------------------------
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

create temp table t_ids (k text primary key, id uuid) on commit drop;
grant all on t_ids to authenticated;

insert into t_ids values ('salary', public.register_income(
  '{"label":"Pay","amount_cents":100000,"received_on":"2026-11-15","funded_period_start":"2026-11-16","is_recurring":true,"distributed":false,"income_type":"salary"}'::jsonb,
  '[]'::jsonb));
insert into t_ids values ('legacy', public.register_income(
  '{"label":"Old client","amount_cents":5000,"received_on":"2026-11-15","funded_period_start":"2026-11-16","is_recurring":false,"distributed":false}'::jsonb,
  '[]'::jsonb));

select is((select income_type::text from incomes where id = (select id from t_ids where k = 'salary')),
  'salary', 'register_income stores the income type');
select is((select income_type::text from incomes where id = (select id from t_ids where k = 'legacy')),
  'other', 'register_income without a type stores other (previous frontend keeps working)');

select public.replace_income((select id from t_ids where k = 'salary'),
  '{"label":"Pay","amount_cents":100000,"received_on":"2026-11-15","funded_period_start":"2026-11-16","is_recurring":true,"distributed":false,"income_type":"gift"}'::jsonb,
  '[]'::jsonb);
select is((select income_type::text from incomes where id = (select id from t_ids where k = 'salary')),
  'gift', 'replace_income changes the income type');

-- A client role can't run the backfill.
select throws_ok($$ select private.apply_taxonomy_004('bbbbbbbb-0000-0000-0000-000000000002') $$,
  '42501', null, 'authenticated cannot execute private.apply_taxonomy_004');

select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

-- ---------- Backfill on an account shaped like the owner's ------------------
-- The 25 active categories of the cloud account (Housing already keyed), an archived old default,
-- a user-created category and a renamed default.
insert into categories (user_id, name, name_key, macro, archived_at)
select 'bbbbbbbb-0000-0000-0000-000000000002', n, k, m::spend_bucket, a
from (values
  ('Housing', 'taxonomy.housing', 'needs', null::timestamptz),
  ('Home Services', null, 'needs', null), ('Telecom', null, 'needs', null),
  ('Transport & Gas', null, 'needs', null), ('Groceries', null, 'needs', null),
  ('Health & Insurance', null, 'needs', null), ('Gym & Wellness', null, 'needs', null),
  ('Fixed Subscriptions', null, 'needs', null), ('Maintenance & Contingencies', null, 'needs', null),
  ('Education & Development', null, 'needs', null), ('Bank Fees & Taxes', null, 'needs', null),
  ('Pets', null, 'needs', null),
  ('Restaurants & Cafes', null, 'wants', null), ('Entertainment & Leisure', null, 'wants', null),
  ('Streaming', null, 'wants', null), ('Clothes & Shoes', null, 'wants', null),
  ('Personal Care', null, 'wants', null), ('Gifts & Commitments', null, 'wants', null),
  ('Pocket Money / Snacks', null, 'wants', null), ('Tech & Gadgets', null, 'wants', null),
  ('Travel & Getaways', null, 'wants', null), ('Home & Furniture', null, 'wants', null),
  ('Hobbies & Sports', null, 'wants', null), ('Donations', null, 'wants', null),
  ('Other', null, 'wants', null),
  ('Food', 'taxonomy.food', 'needs', now()),
  ('Mi categoría', null, 'wants', null),
  ('Pets & Vet', null, 'needs', null)            -- a default the user renamed: not "Pets" any more
) as v(n, k, m, a);

insert into subcategories (user_id, category_id, name, name_key)
select 'bbbbbbbb-0000-0000-0000-000000000002', c.id, s, sk
from categories c
join (values ('Housing', 'Rent', 'taxonomy.rent'), ('Streaming', 'Video streaming', null),
             ('Food', 'Groceries', 'taxonomy.groceries')) as v(cat, s, sk)
  on v.cat = c.name
where c.user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

create temp table t_subs_before on commit drop as
  select id, name, name_key, icon, archived_at from subcategories
   where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select lives_ok($$ select private.apply_taxonomy_004('bbbbbbbb-0000-0000-0000-000000000002') $$,
  'backfill runs');
select lives_ok($$ select private.apply_taxonomy_004('bbbbbbbb-0000-0000-0000-000000000002') $$,
  'backfill runs a second time (idempotent)');

select is(
  (select count(*)::int from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and archived_at is null
      and name_key is not null and icon is not null and name not in ('Mi categoría', 'Pets & Vet')),
  26, 'the 25 matching categories and Previous Balances get a key and an icon');
select is(
  (select name_key || ' ' || icon from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and name = 'Pocket Money / Snacks'),
  'taxonomy.categories.pocketMoney candy', 'categories are matched by their exact name');
select is(
  (select name_key || ' ' || icon from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and name = 'Housing'),
  'taxonomy.housing house', 'Housing keeps its key and gets its icon');
select is(
  (select count(*)::int from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and name = 'Previous Balances'
      and macro = 'needs' and name_key = 'taxonomy.categories.previousBalances' and icon = 'clock-arrow-left'),
  1, 'exactly one Previous Balances in Needs');
select is(
  (select string_agg(s.name, ',') from subcategories s join categories c on c.id = s.category_id
    where c.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and c.name = 'Previous Balances'),
  'Previous balances', 'Previous Balances has its single subcategory');
select is(
  (select name_key || ' ' || coalesce(icon, '∅') from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and name = 'Food'),
  'taxonomy.food ∅', 'archived categories are not touched');
select is(
  (select coalesce(name_key, '∅') || ' ' || coalesce(icon, '∅') from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and name = 'Mi categoría'),
  '∅ ∅', 'user-created categories are not touched');
select is(
  (select coalesce(name_key, '∅') || ' ' || coalesce(icon, '∅') from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and name = 'Pets & Vet'),
  '∅ ∅', 'renamed defaults are not touched');
select is(
  (select count(*)::int from categories where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  29, 'no duplicated categories (28 seeded + Previous Balances)');
select set_eq(
  $$ select s.id, s.name, s.name_key, s.icon, s.archived_at from subcategories s
       join categories c on c.id = s.category_id
      where s.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and c.name <> 'Previous Balances' $$,
  $$ select id, name, name_key, icon, archived_at from t_subs_before $$,
  'existing subcategories are not touched');
select is(
  (select count(*)::int from categories
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000001' and name = 'Previous Balances'),
  0, 'the backfill only touches the account it is given');

select * from finish();
rollback;
