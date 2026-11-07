-- =============================================================================
-- Spec 007 (T017): update_account_with_installments — card terms and MSI dates in one
-- transaction, only for that card's not-collected installments; RLS and grants
-- (contracts/data-provider.md § SQL).
-- Run: pnpm db:test
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select has_function('public', 'update_account_with_installments', array['uuid', 'jsonb', 'jsonb'],
  'update_account_with_installments exists');
select ok(
  not (select prosecdef from pg_proc where proname = 'update_account_with_installments'),
  'it is SECURITY INVOKER');

-- ---------- Fixtures (user A: card 1 with a 3-month MSI, card 2 with 1 month) ---------------
insert into auth.users (id, email, aud, role) values
  ('a7000000-0000-0000-0000-000000000001', 'cards@test.local', 'authenticated', 'authenticated'),
  ('a7000000-0000-0000-0000-000000000002', 'intruder@test.local', 'authenticated', 'authenticated');

insert into accounts (id, user_id, kind, name, cut_off_day, payment_due_offset_days) values
  ('ac700000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001',
   'credit_card', 'Banregio', 15, 20),
  ('ac700000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000001',
   'credit_card', 'Other card', 1, 20);
insert into debtors (id, user_id, name) values
  ('de700000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'Ana');
insert into receivables (id, user_id, debtor_id, card_account_id, description, total_cents,
                         term_months, purchase_date) values
  ('7c700000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001',
   'de700000-0000-0000-0000-000000000001', 'ac700000-0000-0000-0000-000000000001',
   'Phone', 30000, 3, '2026-10-20'),
  ('7c700000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000001',
   'de700000-0000-0000-0000-000000000001', 'ac700000-0000-0000-0000-000000000002',
   'Headphones', 5000, 1, '2026-10-20');
insert into installments (id, user_id, receivable_id, seq, due_on, card_due_on, amount_cents,
                          collected_cents, collected_on, status) values
  ('1a700000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001',
   '7c700000-0000-0000-0000-000000000001', 1, '2026-12-02', '2026-12-05', 10000, 10000,
   '2026-12-01', 'collected'),
  ('1a700000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000001',
   '7c700000-0000-0000-0000-000000000001', 2, '2027-01-01', '2027-01-04', 10000, 0, null, 'pending'),
  ('1a700000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000001',
   '7c700000-0000-0000-0000-000000000001', 3, '2027-02-01', '2027-02-04', 10000, 5000,
   '2027-01-30', 'partial'),
  ('1a700000-0000-0000-0000-000000000004', 'a7000000-0000-0000-0000-000000000001',
   '7c700000-0000-0000-0000-000000000002', 1, '2026-11-18', '2026-11-21', 5000, 0, null, 'pending');

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.as_user('a7000000-0000-0000-0000-000000000001');

-- ---------- C1: terms + not-collected installments together --------------------------------
select is(
  (select cut_off_day from update_account_with_installments(
     'ac700000-0000-0000-0000-000000000001',
     '{"cut_off_day": 14, "payment_due_offset_days": 21}',
     '[{"id": "1a700000-0000-0000-0000-000000000002", "due_on": "2027-01-01", "card_due_on": "2027-01-04"},
       {"id": "1a700000-0000-0000-0000-000000000003", "due_on": "2027-02-01", "card_due_on": "2027-02-04"}]')),
  14::smallint, 'C1: returns the account with its new terms');
select is(
  (select payment_due_offset_days from accounts where id = 'ac700000-0000-0000-0000-000000000001'),
  21::smallint, 'C1: the days to pay changed');
select is(
  (select name from accounts where id = 'ac700000-0000-0000-0000-000000000001'),
  'Banregio', 'C1: keys missing from the patch keep their value');

-- Second pass with new dates: a partial one is rescheduled too.
select lives_ok($$
  select update_account_with_installments('ac700000-0000-0000-0000-000000000001', '{}',
    '[{"id": "1a700000-0000-0000-0000-000000000003", "due_on": "2027-02-02", "card_due_on": "2027-02-05"}]')
$$, 'C4: an empty patch only reschedules installments');
select is(
  (select card_due_on from installments where id = '1a700000-0000-0000-0000-000000000003'),
  '2027-02-05'::date, 'C4: the partial installment moved');

-- ---------- C2: a collected installment rolls everything back ------------------------------
select throws_ok($$
  select update_account_with_installments('ac700000-0000-0000-0000-000000000001',
    '{"cut_off_day": 10}',
    '[{"id": "1a700000-0000-0000-0000-000000000002", "due_on": "2027-01-10", "card_due_on": "2027-01-13"},
      {"id": "1a700000-0000-0000-0000-000000000001", "due_on": "2026-12-10", "card_due_on": "2026-12-13"}]')
$$, '23514', null, 'C2: a collected installment is rejected');
select is(
  (select cut_off_day from accounts where id = 'ac700000-0000-0000-0000-000000000001'),
  14::smallint, 'C2: the card did not change');
select is(
  (select card_due_on from installments where id = '1a700000-0000-0000-0000-000000000002'),
  '2027-01-04'::date, 'C2: the pending installment did not change');
select is(
  (select card_due_on from installments where id = '1a700000-0000-0000-0000-000000000001'),
  '2026-12-05'::date, 'C2: the collected installment did not change');

-- ---------- C3: another card's installment rolls everything back ---------------------------
select throws_ok($$
  select update_account_with_installments('ac700000-0000-0000-0000-000000000001',
    '{"cut_off_day": 10}',
    '[{"id": "1a700000-0000-0000-0000-000000000004", "due_on": "2026-11-10", "card_due_on": "2026-11-13"}]')
$$, '23514', null, 'C3: an installment of another card is rejected');
select is(
  (select cut_off_day from accounts where id = 'ac700000-0000-0000-0000-000000000001'),
  14::smallint, 'C3: the card did not change');
select is(
  (select card_due_on from installments where id = '1a700000-0000-0000-0000-000000000004'),
  '2026-11-21'::date, 'C3: the other card''s installment did not change');

-- ---------- C6 / RLS: unknown card, or another user's card ---------------------------------
select throws_ok($$
  select update_account_with_installments('ac700000-0000-0000-0000-0000000000ff', '{"name": "X"}', '[]')
$$, 'P0002', null, 'C6: an unknown account is NOT_FOUND');

select pg_temp.as_user('a7000000-0000-0000-0000-000000000002');
select throws_ok($$
  select update_account_with_installments('ac700000-0000-0000-0000-000000000001',
    '{"cut_off_day": 1}',
    '[{"id": "1a700000-0000-0000-0000-000000000002", "due_on": "2027-01-10", "card_due_on": "2027-01-13"}]')
$$, 'P0002', null, 'user B cannot see user A''s card (RLS)');

reset role;
select is(
  (select cut_off_day from accounts where id = 'ac700000-0000-0000-0000-000000000001'),
  14::smallint, 'user B changed nothing');

-- ---------- Grants -------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated',
    'public.update_account_with_installments(uuid, jsonb, jsonb)', 'execute'),
  'authenticated can execute it');
select ok(
  not has_function_privilege('anon',
    'public.update_account_with_installments(uuid, jsonb, jsonb)', 'execute'),
  'anon cannot execute it');

select * from finish();
rollback;
