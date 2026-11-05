-- =============================================================================
-- 0008 · Spec 004: income types, taxonomy icons and the owner's taxonomy as the default.
--
--  1. income_type enum + incomes.income_type (existing rows → 'other', FR-007).
--  2. Optional icon on categories and subcategories. The DB only checks the FORMAT (short kebab-case
--     key); membership in the curated set is validated by the app, so adding icons needs no migration.
--  3. register_income / replace_income also store the type. The coalesce to 'other' keeps the
--     previous frontend working between applying this migration and deploying the new one; the
--     new form makes the type mandatory (Clarification B).
--  4. private.apply_taxonomy_004(user): gives the account's existing categories (matched by exact
--     name) the default i18n key and icon, and adds "Previous Balances" (Needs). Idempotent; it
--     never touches subcategories, archived or renamed categories, movements or rules. It lives in a
--     schema PostgREST does not expose, and no client role may execute it.
-- =============================================================================

-- ---------- 1. Income type --------------------------------------------------
create type public.income_type as enum (
  'salary', 'gift', 'debt_repayment', 'cashback', 'extra',
  'sales', 'savings', 'investment_returns', 'other'
);

alter table public.incomes
  add column income_type public.income_type not null default 'other';

-- ---------- 2. Icons --------------------------------------------------------
alter table public.categories
  add column icon text
    check (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 40);

alter table public.subcategories
  add column icon text
    check (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 40);

-- ---------- 3. Income RPCs (same signature, grants from 0005 are kept) -------
create or replace function public.register_income(p_income jsonb, p_allocations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid;
begin
  insert into incomes (label, amount_cents, received_on, funded_period_start, is_recurring, distributed, rule_id, deposit_account_id, income_type)
  values (p_income ->> 'label',
          (p_income ->> 'amount_cents')::bigint,
          (p_income ->> 'received_on')::date,
          (p_income ->> 'funded_period_start')::date,
          coalesce((p_income ->> 'is_recurring')::boolean, true),
          coalesce((p_income ->> 'distributed')::boolean, true),
          nullif(p_income ->> 'rule_id', '')::uuid,
          nullif(p_income ->> 'deposit_account_id', '')::uuid,
          coalesce(nullif(p_income ->> 'income_type', ''), 'other')::public.income_type)
  returning id into v_id;

  insert into income_allocations (income_id, bucket, account_id, amount_cents, period_start)
  select v_id, (a ->> 'bucket')::bucket_kind, nullif(a ->> 'account_id', '')::uuid,
         (a ->> 'amount_cents')::bigint, (a ->> 'period_start')::date
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as a;

  return v_id;          -- the exact sum is validated at COMMIT (deferred trigger)
end $$;

create or replace function public.replace_income(p_id uuid, p_income jsonb, p_allocations jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  update incomes
     set label               = p_income ->> 'label',
         amount_cents        = (p_income ->> 'amount_cents')::bigint,
         received_on         = (p_income ->> 'received_on')::date,
         funded_period_start = (p_income ->> 'funded_period_start')::date,
         is_recurring        = coalesce((p_income ->> 'is_recurring')::boolean, true),
         distributed         = coalesce((p_income ->> 'distributed')::boolean, true),
         rule_id             = nullif(p_income ->> 'rule_id', '')::uuid,
         deposit_account_id  = nullif(p_income ->> 'deposit_account_id', '')::uuid,
         income_type         = coalesce(nullif(p_income ->> 'income_type', ''), 'other')::public.income_type
   where id = p_id;
  if not found then
    raise exception 'income % not found', p_id using errcode = 'P0002';   -- → NOT_FOUND
  end if;

  delete from income_allocations where income_id = p_id;
  insert into income_allocations (income_id, bucket, account_id, amount_cents, period_start)
  select p_id, (a ->> 'bucket')::bucket_kind, nullif(a ->> 'account_id', '')::uuid,
         (a ->> 'amount_cents')::bigint, (a ->> 'period_start')::date
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as a;

  return p_id;
end $$;

-- ---------- 4. Backfill of existing accounts --------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- The (name, name_key, icon) list MUST match src/domain/default-taxonomy.ts
-- (tests/unit/domain/default-taxonomy.test.ts reads it from this file).
create function private.apply_taxonomy_004(p_user uuid)
returns void
language plpgsql
set search_path = public
as $$
declare v_category uuid;
begin
  update public.categories c
     set name_key = d.name_key,
         icon     = d.icon
    from (values
      -- taxonomy-004:start
      ('Housing',                     'taxonomy.housing',                       'house'),
      ('Home Services',               'taxonomy.categories.homeServices',       'plug'),
      ('Telecom',                     'taxonomy.categories.telecom',            'smartphone'),
      ('Transport & Gas',             'taxonomy.categories.transportGas',       'car'),
      ('Groceries',                   'taxonomy.categories.groceries',          'shopping-cart'),
      ('Health & Insurance',          'taxonomy.categories.healthInsurance',    'heart-pulse'),
      ('Gym & Wellness',              'taxonomy.categories.gymWellness',        'dumbbell'),
      ('Fixed Subscriptions',         'taxonomy.categories.fixedSubscriptions', 'repeat'),
      ('Maintenance & Contingencies', 'taxonomy.categories.maintenance',        'wrench'),
      ('Education & Development',     'taxonomy.categories.education',          'graduation-cap'),
      ('Bank Fees & Taxes',           'taxonomy.categories.bankFees',           'landmark'),
      ('Pets',                        'taxonomy.categories.pets',               'paw-print'),
      ('Previous Balances',           'taxonomy.categories.previousBalances',   'clock-arrow-left'),
      ('Restaurants & Cafes',         'taxonomy.categories.restaurants',        'utensils'),
      ('Entertainment & Leisure',     'taxonomy.categories.entertainment',      'ticket'),
      ('Streaming',                   'taxonomy.categories.streaming',          'tv'),
      ('Clothes & Shoes',             'taxonomy.categories.clothes',            'shirt'),
      ('Personal Care',               'taxonomy.categories.personalCare',       'scissors'),
      ('Gifts & Commitments',         'taxonomy.categories.gifts',              'gift'),
      ('Pocket Money / Snacks',       'taxonomy.categories.pocketMoney',        'candy'),
      ('Tech & Gadgets',              'taxonomy.categories.tech',               'headphones'),
      ('Travel & Getaways',           'taxonomy.categories.travel',             'plane'),
      ('Home & Furniture',            'taxonomy.categories.homeFurniture',      'sofa'),
      ('Hobbies & Sports',            'taxonomy.categories.hobbies',            'palette'),
      ('Donations',                   'taxonomy.categories.donations',          'hand-heart'),
      ('Other',                       'taxonomy.categories.other',              'ellipsis')
      -- taxonomy-004:end
    ) as d(name, name_key, icon)
   where c.user_id = p_user
     and c.name = d.name
     and c.archived_at is null
     and (c.name_key is null or c.name_key = d.name_key);

  insert into public.categories (user_id, name, name_key, macro, icon)
  values (p_user, 'Previous Balances', 'taxonomy.categories.previousBalances', 'needs', 'clock-arrow-left')
  on conflict (user_id, name) do nothing
  returning id into v_category;

  if v_category is not null then
    insert into public.subcategories (user_id, category_id, name)
    values (p_user, v_category, 'Previous balances');
  end if;
end $$;

revoke execute on function private.apply_taxonomy_004(uuid) from public, anon, authenticated;

-- Only accounts that already went through onboarding (new ones get the new default from the app).
select private.apply_taxonomy_004(u.user_id)
  from (select distinct user_id from public.categories) as u;
