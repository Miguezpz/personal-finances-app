-- =============================================================================
-- Spec 005 (T003): expense_templates checks, composite FK and updated_at trigger
-- (data-model.md, contracts/data-provider.md § SQL).
-- Run: pnpm db:test
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- ---------- Schema ----------------------------------------------------------
select has_table('public', 'expense_templates', 'expense_templates exists');
select col_is_null('public', 'expense_templates', 'payment_account_id', 'payment_account_id is nullable');
select col_default_is('public', 'expense_templates', 'archived', 'false', 'archived defaults to false');
select col_default_is('public', 'expense_templates', 'sort', '0', 'sort defaults to 0');
select hasnt_column('public', 'expense_templates', 'bucket', 'templates store no bucket (FR-003)');

-- ---------- Fixtures --------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'templates@test.local', 'authenticated', 'authenticated'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'other@test.local', 'authenticated', 'authenticated');

insert into categories (id, user_id, name, macro) values
  ('c5000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Transport', 'needs'),
  ('c5000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002', 'Transport', 'needs');
insert into subcategories (id, user_id, category_id, name) values
  ('55000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
   'c5000000-0000-0000-0000-000000000001', 'Public transport'),
  ('55000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002',
   'c5000000-0000-0000-0000-000000000002', 'Public transport');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- ---------- Checks ----------------------------------------------------------
select lives_ok($$
  insert into expense_templates (id, name, amount_cents, subcategory_id)
  values ('7e500000-0000-0000-0000-000000000001', 'Transporte', 2400, '55000000-0000-0000-0000-000000000001')
$$, 'a valid template is accepted');
select lives_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id)
  values (repeat('a', 40), 1, '55000000-0000-0000-0000-000000000001')
$$, 'a 40-character name is accepted');

select throws_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id)
  values ('', 2400, '55000000-0000-0000-0000-000000000001')
$$, '23514', null, 'an empty name is rejected');
select throws_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id)
  values (repeat('a', 41), 2400, '55000000-0000-0000-0000-000000000001')
$$, '23514', null, 'a 41-character name is rejected');
select throws_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id)
  values ('Zero', 0, '55000000-0000-0000-0000-000000000001')
$$, '23514', null, 'amount_cents = 0 is rejected');
select throws_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id, sort)
  values ('Negative sort', 100, '55000000-0000-0000-0000-000000000001', -1)
$$, '23514', null, 'sort = -1 is rejected');

-- ---------- Composite FK ----------------------------------------------------
select throws_ok($$
  insert into expense_templates (name, amount_cents, subcategory_id)
  values ('Other user', 100, '55000000-0000-0000-0000-000000000002')
$$, '23503', null, 'a subcategory of another user is rejected (composite FK)');

-- ---------- updated_at ------------------------------------------------------
reset role;
update expense_templates set updated_at = '2000-01-01T00:00:00Z'
 where id = '7e500000-0000-0000-0000-000000000001';
select set_config('role', 'authenticated', true);
update expense_templates set amount_cents = 3000 where id = '7e500000-0000-0000-0000-000000000001';
select ok(
  (select updated_at > '2000-01-01T00:00:00Z'::timestamptz from expense_templates
    where id = '7e500000-0000-0000-0000-000000000001'),
  'updated_at changes on update');

reset role;
select * from finish();
rollback;
