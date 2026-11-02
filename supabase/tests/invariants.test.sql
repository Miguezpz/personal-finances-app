-- =============================================================================
-- T025 · Invariants: exact sums (FR-004, FR-023, FR-002), rule snapshots (FR-005) and
-- idempotency of recurring expenses (FR-010) and goal contributions.
--
-- Deferred constraint triggers fire at COMMIT, which a single test transaction never reaches.
-- We assert that they ARE deferrable/initially deferred, and simulate a commit per scenario with
-- pg_temp.at_commit(sql): run the statement, then SET CONSTRAINTS ALL IMMEDIATE fires the checks
-- it queued (exactly what COMMIT does) and DEFERRED restores the normal mode. A failing scenario
-- runs inside pgTAP's subtransaction, so its rows and queued checks are rolled back with it.
-- (Plain IMMEDIATE mode would be wrong: it validates after each statement *inside* an RPC.)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- ---------- The sum triggers are deferred until COMMIT ----------------------
select is(
  (select count(*)::int from pg_trigger
    where tgname in ('trg_allocations_sum','trg_income_total','trg_installments_sum',
                     'trg_receivable_total','trg_subrules_sum','trg_rule_investment')
      and tgdeferrable and tginitdeferred and tgconstraint <> 0),
  6,
  'the 6 sum triggers are DEFERRABLE INITIALLY DEFERRED constraint triggers'
);

insert into auth.users (id, email, aud, role)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@test.local', 'authenticated', 'authenticated');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

create function pg_temp.at_commit(p_sql text) returns void language plpgsql as $f$
begin
  execute p_sql;
  set constraints all immediate;   -- fire the deferred checks queued by p_sql, as COMMIT would
  set constraints all deferred;
end $f$;
create function pg_temp.lives_at_commit(p_sql text, p_desc text) returns text language sql as $f$
  select extensions.lives_ok(format('select pg_temp.at_commit(%L)', p_sql), p_desc)
$f$;
create function pg_temp.throws_at_commit(p_sql text, p_code text, p_desc text) returns text language sql as $f$
  select extensions.throws_ok(format('select pg_temp.at_commit(%L)', p_sql), p_code, null, p_desc)
$f$;

-- ---------- Fixtures --------------------------------------------------------
insert into accounts (id, kind, name) values
  ('a1000000-0000-0000-0000-000000000001', 'investment', 'Stocks'),
  ('a2000000-0000-0000-0000-000000000002', 'investment', 'Sofipos');
insert into accounts (id, kind, name, cut_off_day, payment_due_offset_days) values
  ('a3000000-0000-0000-0000-000000000003', 'credit_card', 'Card', 10, 20);
insert into categories (id, name, macro) values ('c0000000-0000-0000-0000-00000000000c', 'Home', 'needs');
insert into subcategories (id, category_id, name)
values ('50000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-00000000000c', 'Rent');
insert into debtors (id, name) values ('d0000000-0000-0000-0000-00000000000d', 'Ana');

-- ---------- Distribution rules and sub-rules (FR-001/002) -------------------
select pg_temp.lives_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-01","needs_bps":5000,"wants_bps":3000,"investment_bps":2000}',
    '[{"account_id":"a1000000-0000-0000-0000-000000000001","pct_bps":9000},
      {"account_id":"a2000000-0000-0000-0000-000000000002","pct_bps":1000}]')
$$, 'a 50/30/20 rule with 90/10 sub-rules is saved');

select pg_temp.throws_at_commit($$
  insert into distribution_rules (effective_from, needs_bps, wants_bps, investment_bps)
  values ('2026-12-01', 5000, 3000, 3000)
$$, '23514', 'rule percentages must sum to exactly 10000 bps');

select pg_temp.throws_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-02","needs_bps":5000,"wants_bps":3000,"investment_bps":2000}',
    '[{"account_id":"a1000000-0000-0000-0000-000000000001","pct_bps":9000}]')
$$, '23514', 'sub-rules ≠ 10000 with investment_bps > 0 are rejected');

select pg_temp.throws_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-03","needs_bps":5000,"wants_bps":3000,"investment_bps":2000}', '[]')
$$, '23514', 'investment_bps > 0 without any sub-rule is rejected');

select pg_temp.throws_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-04","needs_bps":6000,"wants_bps":4000,"investment_bps":0}',
    '[{"account_id":"a1000000-0000-0000-0000-000000000001","pct_bps":10000}]')
$$, '23514', 'sub-rules require investment_bps > 0');

-- ---------- Incomes: Σ allocations = amount (FR-004) ------------------------
select pg_temp.lives_at_commit($$
  select register_income(
    jsonb_build_object('label','Salary','amount_cents',2000000,'received_on','2026-11-15',
      'funded_period_start','2026-11-16',
      'rule_id',(select id from distribution_rules where effective_from = '2026-11-01')),
    '[{"bucket":"needs","amount_cents":1000000,"period_start":"2026-11-16"},
      {"bucket":"wants","amount_cents":600000,"period_start":"2026-11-16"},
      {"bucket":"investment","account_id":"a1000000-0000-0000-0000-000000000001","amount_cents":360000,"period_start":"2026-11-16"},
      {"bucket":"investment","account_id":"a2000000-0000-0000-0000-000000000002","amount_cents":40000,"period_start":"2026-11-16"}]')
$$, 'an income whose allocations sum exactly is registered');

select pg_temp.throws_at_commit($$
  select register_income(
    '{"label":"Bad","amount_cents":2000000,"received_on":"2026-11-15","funded_period_start":"2026-11-16"}',
    '[{"bucket":"needs","amount_cents":1999999,"period_start":"2026-11-16"}]')
$$, '23514', 'allocations that do not sum to the income amount are rejected');

select pg_temp.throws_at_commit($$
  insert into incomes (label, amount_cents, received_on, funded_period_start, distributed)
  values ('Orphan', 5000, '2026-11-15', '2026-11-16', true)
$$, '23514', 'a distributed income without allocations is rejected');

select pg_temp.lives_at_commit($$
  insert into incomes (label, amount_cents, received_on, funded_period_start, distributed)
  values ('Gift', 5000, '2026-11-15', '2026-11-16', false)
$$, 'an income recorded without splitting needs no allocations');

select pg_temp.throws_at_commit($$
  select register_income(
    '{"label":"Mixed","amount_cents":100,"received_on":"2026-11-15","funded_period_start":"2026-11-16","distributed":false}',
    '[{"bucket":"needs","amount_cents":100,"period_start":"2026-11-16"}]')
$$, '23514', 'an undistributed income cannot have allocations');

select pg_temp.throws_at_commit($$
  update incomes set amount_cents = amount_cents + 1 where label = 'Salary'
$$, '23514', 'changing the income amount without recalculating allocations is rejected');

select pg_temp.throws_at_commit($$
  delete from income_allocations where bucket = 'wants'
    and income_id = (select id from incomes where label = 'Salary')
$$, '23514', 'removing an allocation breaks the sum and is rejected');

select pg_temp.lives_at_commit($$
  select replace_income(
    (select id from incomes where label = 'Salary'),
    jsonb_build_object('label','Salary','amount_cents',2000001,'received_on','2026-11-15',
      'funded_period_start','2026-11-16',
      'rule_id',(select id from distribution_rules where effective_from = '2026-11-01')),
    '[{"bucket":"needs","amount_cents":1000001,"period_start":"2026-11-16"},
      {"bucket":"wants","amount_cents":600000,"period_start":"2026-11-16"},
      {"bucket":"investment","account_id":"a1000000-0000-0000-0000-000000000001","amount_cents":360000,"period_start":"2026-11-16"},
      {"bucket":"investment","account_id":"a2000000-0000-0000-0000-000000000002","amount_cents":40000,"period_start":"2026-11-16"}]')
$$, 'replace_income swaps amount and allocations atomically');
select is((select sum(amount_cents)::bigint from income_allocations
            where income_id = (select id from incomes where label = 'Salary')), 2000001::bigint,
  'replaced allocations sum to the new amount');

select pg_temp.throws_at_commit($$
  select replace_income('00000000-0000-0000-0000-000000000000',
    '{"label":"x","amount_cents":1,"received_on":"2026-11-15","funded_period_start":"2026-11-16","distributed":false}', '[]')
$$, 'P0002', 'replace_income on a missing income raises no_data_found');

-- ---------- Rules already used by incomes are immutable (FR-005) ------------
select pg_temp.throws_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-01","needs_bps":6000,"wants_bps":2000,"investment_bps":2000}',
    '[{"account_id":"a1000000-0000-0000-0000-000000000001","pct_bps":10000}]')
$$, '23505', 'save_distribution_rule refuses to rewrite a rule already used by incomes');

select pg_temp.lives_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-02","needs_bps":6000,"wants_bps":2000,"investment_bps":2000}',
    '[{"account_id":"a1000000-0000-0000-0000-000000000001","pct_bps":10000}]')
$$, 'a new rule with a later effective_from is accepted');

select pg_temp.lives_at_commit($$
  select save_distribution_rule(
    '{"effective_from":"2026-11-02","needs_bps":7000,"wants_bps":3000,"investment_bps":0}', '[]')
$$, 'an unused rule can be overwritten for the same effective_from');
select is((select count(*)::int from investment_subrules
            where rule_id = (select id from distribution_rules where effective_from = '2026-11-02')), 0,
  'overwriting replaces its sub-rules');

-- ---------- Receivables: Σ installments = total, count = term (FR-023) -------
select pg_temp.lives_at_commit($$
  select create_receivable(
    '{"debtor_id":"d0000000-0000-0000-0000-00000000000d","card_account_id":"a3000000-0000-0000-0000-000000000003",
      "description":"Phone","total_cents":1200000,"term_months":2,"purchase_date":"2026-11-05"}',
    '[{"seq":1,"due_on":"2026-11-27","card_due_on":"2026-11-30","amount_cents":600000},
      {"seq":2,"due_on":"2026-12-27","card_due_on":"2026-12-30","amount_cents":600000}]')
$$, 'a receivable whose installments sum exactly is created');

select pg_temp.throws_at_commit($$
  select create_receivable(
    '{"debtor_id":"d0000000-0000-0000-0000-00000000000d","card_account_id":"a3000000-0000-0000-0000-000000000003",
      "description":"Bad sum","total_cents":1200000,"term_months":2,"purchase_date":"2026-11-05"}',
    '[{"seq":1,"due_on":"2026-11-27","card_due_on":"2026-11-30","amount_cents":600000},
      {"seq":2,"due_on":"2026-12-27","card_due_on":"2026-12-30","amount_cents":599999}]')
$$, '23514', 'installments that do not sum to the total are rejected');

select pg_temp.throws_at_commit($$
  select create_receivable(
    '{"debtor_id":"d0000000-0000-0000-0000-00000000000d","card_account_id":"a3000000-0000-0000-0000-000000000003",
      "description":"No installments","total_cents":1200000,"term_months":2,"purchase_date":"2026-11-05"}', '[]')
$$, '23514', 'a receivable without installments is rejected');

select pg_temp.throws_at_commit($$
  select create_receivable(
    '{"debtor_id":"d0000000-0000-0000-0000-00000000000d","card_account_id":"a3000000-0000-0000-0000-000000000003",
      "description":"Wrong count","total_cents":1200000,"term_months":3,"purchase_date":"2026-11-05"}',
    '[{"seq":1,"due_on":"2026-11-27","card_due_on":"2026-11-30","amount_cents":600000},
      {"seq":2,"due_on":"2026-12-27","card_due_on":"2026-12-30","amount_cents":600000}]')
$$, '23514', 'an installment count different from term_months is rejected');

select pg_temp.throws_at_commit($$
  update installments set collected_cents = 100 where seq = 1
$$, '23514', 'installment status must match collected_cents');
select pg_temp.lives_at_commit($$
  update installments set collected_cents = 100, status = 'partial', collected_on = '2026-11-20' where seq = 1
$$, 'a partial collection with status partial is accepted');

-- ---------- Recurring expenses: idempotent materialization (FR-010) ---------
insert into recurring_expenses (id, name, amount_cents, charge_day, subcategory_id, bucket, starts_on)
values ('e0000000-0000-0000-0000-00000000000e', 'Rent', 800000, 1, '50000000-0000-0000-0000-000000000005', 'needs', '2026-11-01');

select pg_temp.lives_at_commit($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket, origin, recurring_expense_id, occurrence_date)
  values (800000, '2026-11-01', '50000000-0000-0000-0000-000000000005', 'needs', 'recurring',
          'e0000000-0000-0000-0000-00000000000e', '2026-11-01')
$$, 'the first occurrence of a recurring expense is applied');

select pg_temp.throws_at_commit($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket, origin, recurring_expense_id, occurrence_date)
  values (800000, '2026-11-01', '50000000-0000-0000-0000-000000000005', 'needs', 'recurring',
          'e0000000-0000-0000-0000-00000000000e', '2026-11-01')
$$, '23505', 'the same (recurring_expense_id, occurrence_date) cannot be applied twice');

select results_eq($$
  with ins as (
    insert into expenses (amount_cents, spent_on, subcategory_id, bucket, origin, recurring_expense_id, occurrence_date)
    values (800000, '2026-11-01', '50000000-0000-0000-0000-000000000005', 'needs', 'recurring',
            'e0000000-0000-0000-0000-00000000000e', '2026-11-01')
    on conflict (recurring_expense_id, occurrence_date) do nothing
    returning 1)
  select count(*)::int from ins
$$, array[0],
  'ON CONFLICT (recurring_expense_id, occurrence_date) DO NOTHING infers the unique key (PostgREST upsert)');

select pg_temp.lives_at_commit($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket) values
    (100, '2026-11-02', '50000000-0000-0000-0000-000000000005', 'needs'),
    (100, '2026-11-02', '50000000-0000-0000-0000-000000000005', 'needs')
$$, 'manual expenses (NULL keys) never collide');

select pg_temp.throws_at_commit($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket, recurring_expense_id, occurrence_date)
  values (100, '2026-11-02', '50000000-0000-0000-0000-000000000005', 'needs', 'e0000000-0000-0000-0000-00000000000e', '2026-11-02')
$$, '23514', 'a manual expense cannot point to a recurring expense');

select pg_temp.throws_at_commit($$
  insert into expenses (amount_cents, spent_on, subcategory_id, bucket) values (0, '2026-11-02', '50000000-0000-0000-0000-000000000005', 'needs')
$$, '23514', 'expense amounts must be > 0');

select pg_temp.lives_at_commit($$ delete from recurring_expenses where id = 'e0000000-0000-0000-0000-00000000000e' $$,
  'a recurring expense with applied occurrences can be deleted');
select results_eq($$
  select origin::text, recurring_expense_id, occurrence_date, user_id
    from expenses where origin = 'recurring'
$$, $$ values ('recurring', null::uuid, '2026-11-01'::date, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'its applied history survives with the reference cleared and the owner intact (FR-011)');

select pg_temp.throws_at_commit($$
  delete from subcategories where id = '50000000-0000-0000-0000-000000000005'
$$, '23503', 'a subcategory with movements cannot be deleted (US8-4)');

-- ---------- Goal contributions are idempotent per (goal, period) ------------
insert into goals (id, kind, name, source_bucket, annual_cents, monthly_cents)
values ('90000000-0000-0000-0000-000000000009', 'sinking_fund', 'Property tax', 'needs', 1200000, 100000);
select pg_temp.lives_at_commit($$
  insert into goal_contributions (goal_id, period_start, amount_cents, source_bucket)
  values ('90000000-0000-0000-0000-000000000009', '2026-11-01', 100000, 'needs')
$$, 'a goal contribution is recorded');
select pg_temp.throws_at_commit($$
  insert into goal_contributions (goal_id, period_start, amount_cents, source_bucket)
  values ('90000000-0000-0000-0000-000000000009', '2026-11-01', 100000, 'needs')
$$, '23505', 'the same goal contribution period cannot be recorded twice');

-- ---------- Net worth snapshots: one per month ------------------------------
select pg_temp.lives_at_commit($$ insert into net_worth_snapshots (snapshot_on, assets_cents, liabilities_cents) values ('2026-11-01', 500, 200) $$,
  'a monthly net worth snapshot is recorded');
select is((select net_worth_cents from net_worth_snapshots), 300::bigint, 'net worth is generated as assets − liabilities');
select pg_temp.throws_at_commit($$ insert into net_worth_snapshots (snapshot_on, assets_cents, liabilities_cents) values ('2026-11-01', 1, 0) $$,
  '23505', 'only one snapshot per month');

reset role;
select * from finish();
rollback;
