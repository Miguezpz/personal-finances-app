-- =============================================================================
-- 0001 · Schema (T019). Source: specs/_archive/001-personal-finances-core/contracts/db-schema.sql
--
-- Conventions:
--   * Money: bigint MXN CENTS. Percentages: smallint basis points (0–10000).
--   * Business dates: `date` (no time). User time zone lives in user_settings.
--   * Every data table has user_id + RLS (0005); FKs between tables are composite (user_id, id),
--     so no row can reference another user's data even if a policy were wrong.
--   * The database does NOT compute business logic: it only validates invariants.
--
-- Deviations from the design contract (verified against Postgres 17 / PostgREST):
--   1. expenses → recurring_expenses uses `on delete set null (recurring_expense_id)`. A plain
--      `set null` on a composite FK would also null user_id (NOT NULL) and make deletes fail.
--   2. Because of (1) the origin CHECK is split: a 'recurring' expense keeps its occurrence_date
--      as history even after its recurring expense is deleted (FR-011).
--   3. The idempotency unique keys live in 0002 as full UNIQUE constraints (see there).
--   4. subcategories → categories is NO ACTION instead of RESTRICT (see the table).
-- =============================================================================

-- ---------- Types ------------------------------------------------------------
create type public.bucket_kind        as enum ('needs', 'wants', 'investment');
create type public.spend_bucket       as enum ('needs', 'wants');
create type public.account_kind       as enum ('checking', 'savings', 'credit_card', 'investment', 'cash');
create type public.expense_origin     as enum ('manual', 'recurring');
create type public.installment_status as enum ('pending', 'partial', 'collected');
create type public.goal_kind          as enum ('emergency_fund', 'sinking_fund');

-- ---------- Utilities --------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- User settings ----------------------------------------------------
create table public.user_settings (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  timezone              text     not null default 'America/Mexico_City',
  first_payday          smallint not null default 15 check (first_payday  between 1 and 31),
  second_payday         smallint not null default 31 check (second_payday between 1 and 31),
  green_min_bps         smallint not null default 5000 check (green_min_bps  between 1 and 10000),
  yellow_min_bps        smallint not null default 2000 check (yellow_min_bps between 0 and 10000),
  collection_lead_days  smallint not null default 3    check (collection_lead_days between 0 and 15),
  emergency_fund_months smallint not null default 6    check (emergency_fund_months between 1 and 36),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (yellow_min_bps < green_min_bps)
);

-- ---------- Catalog: accounts, cards and platforms ---------------------------
create table public.accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                     public.account_kind not null,
  name                     text not null check (char_length(name) between 1 and 60),
  institution              text check (char_length(institution) <= 60),
  cut_off_day              smallint check (cut_off_day between 1 and 31),            -- cards
  payment_due_offset_days  smallint check (payment_due_offset_days between 1 and 60), -- days after cut-off
  opening_balance_cents    bigint not null default 0,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name),
  check (kind <> 'credit_card' or (cut_off_day is not null and payment_due_offset_days is not null))
);

-- ---------- Distribution rules (versioned by effective date) ------------------
create table public.distribution_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from  date not null,
  needs_bps       smallint not null check (needs_bps      between 0 and 10000),
  wants_bps       smallint not null check (wants_bps      between 0 and 10000),
  investment_bps  smallint not null check (investment_bps between 0 and 10000),
  created_at      timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, effective_from),
  check (needs_bps + wants_bps + investment_bps = 10000)
);

create table public.investment_subrules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id     uuid not null,
  account_id  uuid not null,                          -- vehicle (investment account)
  pct_bps     smallint not null check (pct_bps between 1 and 10000),
  unique (rule_id, account_id),
  foreign key (user_id, rule_id)    references public.distribution_rules (user_id, id) on delete cascade,
  foreign key (user_id, account_id) references public.accounts (user_id, id)
);

-- ---------- Spending taxonomy ------------------------------------------------
create table public.categories (        -- parent category (carries the Needs/Wants macro)
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  name_key    text,                      -- i18n key for default categories
  macro       public.spend_bucket not null,
  archived_at timestamptz,
  unique (user_id, id),
  unique (user_id, name)
);

create table public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  name        text not null check (char_length(name) between 1 and 60),
  name_key    text,
  archived_at timestamptz,
  unique (user_id, id),
  unique (category_id, name),
  -- Deviation 4: NO ACTION (checked at end of statement) instead of RESTRICT (checked mid-cascade),
  -- so deleting the user cascades cleanly; deleting a category with subcategories is still blocked.
  foreign key (user_id, category_id) references public.categories (user_id, id)
);

-- ---------- Incomes and allocations ------------------------------------------
create table public.incomes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label                text not null check (char_length(label) between 1 and 80),
  amount_cents         bigint not null check (amount_cents > 0),
  received_on          date not null,
  funded_period_start  date not null check (extract(day from funded_period_start) in (1, 16)),
  is_recurring         boolean not null default true,
  distributed          boolean not null default true,       -- false = recorded without splitting
  rule_id              uuid,                                 -- rule applied (snapshot)
  deposit_account_id   uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, rule_id)            references public.distribution_rules (user_id, id),
  foreign key (user_id, deposit_account_id) references public.accounts (user_id, id)
);
create index incomes_user_received_idx on public.incomes (user_id, received_on);
create index incomes_rule_idx on public.incomes (user_id, rule_id);

create table public.income_allocations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  income_id     uuid not null,
  bucket        public.bucket_kind not null,
  account_id    uuid,                                        -- vehicle if bucket = investment
  amount_cents  bigint not null check (amount_cents >= 0),
  period_start  date not null check (extract(day from period_start) in (1, 16)),
  foreign key (user_id, income_id)  references public.incomes  (user_id, id) on delete cascade,
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  check ((bucket = 'investment') = (account_id is not null))
);
create index income_allocations_period_idx on public.income_allocations (user_id, period_start, bucket);
create index income_allocations_income_idx on public.income_allocations (income_id);

-- ---------- Recurring expenses and expenses ----------------------------------
create table public.recurring_expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 80),
  amount_cents       bigint not null check (amount_cents > 0),
  charge_day         smallint not null check (charge_day between 1 and 31),
  subcategory_id     uuid not null,
  bucket             public.spend_bucket not null,           -- snapshot of the parent category
  payment_account_id uuid,
  starts_on          date not null,
  ended_on           date,                                   -- paused/ended; NULL = active
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, subcategory_id)     references public.subcategories (user_id, id),
  foreign key (user_id, payment_account_id) references public.accounts (user_id, id),
  check (ended_on is null or ended_on >= starts_on)
);

create table public.expenses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_cents          bigint not null check (amount_cents > 0),
  spent_on              date not null,
  subcategory_id        uuid not null,
  bucket                public.spend_bucket not null,        -- snapshot inherited from the category
  payment_account_id    uuid,                                -- credit card → raises its debt
  note                  text check (char_length(note) <= 200),
  origin                public.expense_origin not null default 'manual',
  recurring_expense_id  uuid,
  occurrence_date       date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, subcategory_id)       references public.subcategories (user_id, id),
  foreign key (user_id, payment_account_id)   references public.accounts (user_id, id),
  -- Deviation 1: only the referencing column is nulled; applied history survives the deletion.
  foreign key (user_id, recurring_expense_id) references public.recurring_expenses (user_id, id)
    on delete set null (recurring_expense_id),
  -- Deviation 2 (contract: (origin = 'recurring') = (recurring_expense_id is not null and occurrence_date is not null)).
  check (origin = 'recurring' or (recurring_expense_id is null and occurrence_date is null)),
  check (origin = 'manual' or occurrence_date is not null)
);
create index expenses_user_spent_idx on public.expenses (user_id, spent_on);

-- ---------- Cards: payments (debt settlement; never touch buckets) ------------
create table public.card_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_account_id  uuid not null,
  from_account_id  uuid,
  amount_cents     bigint not null check (amount_cents > 0),
  paid_on          date not null,
  note             text check (char_length(note) <= 200),
  created_at       timestamptz not null default now(),
  foreign key (user_id, card_account_id) references public.accounts (user_id, id),
  foreign key (user_id, from_account_id) references public.accounts (user_id, id)
);
create index card_payments_user_paid_idx on public.card_payments (user_id, paid_on);

-- ---------- Receivables (MSI purchases for third parties) --------------------
create table public.debtors (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 80),
  unique (user_id, id),
  unique (user_id, name)
);

create table public.receivables (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debtor_id        uuid not null,
  card_account_id  uuid not null,
  description      text not null check (char_length(description) between 1 and 120),
  total_cents      bigint not null check (total_cents > 0),
  term_months      smallint not null check (term_months between 1 and 48),
  purchase_date    date not null,
  created_at       timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, debtor_id)       references public.debtors  (user_id, id),
  foreign key (user_id, card_account_id) references public.accounts (user_id, id)
);

create table public.installments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  receivable_id    uuid not null,
  seq              smallint not null check (seq >= 1),
  due_on           date not null,                -- suggested collection date from the debtor
  card_due_on      date not null,                -- card payment due date for this installment
  amount_cents     bigint not null check (amount_cents > 0),
  collected_cents  bigint not null default 0,
  collected_on     date,
  status           public.installment_status not null default 'pending',
  unique (receivable_id, seq),
  foreign key (user_id, receivable_id) references public.receivables (user_id, id) on delete cascade,
  check (collected_cents between 0 and amount_cents),
  check (status = case
                    when collected_cents = 0            then 'pending'::public.installment_status
                    when collected_cents < amount_cents then 'partial'::public.installment_status
                    else 'collected'::public.installment_status
                  end)
);
create index installments_user_due_idx on public.installments (user_id, due_on) where status <> 'collected';

-- ---------- Goals: emergency fund and sinking funds --------------------------
create table public.goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                  public.goal_kind not null,
  name                  text not null check (char_length(name) between 1 and 80),
  source_bucket         public.bucket_kind not null,   -- which bucket contributions come from
  target_months         smallint check (target_months between 1 and 36),   -- emergency fund
  annual_cents          bigint check (annual_cents > 0),                    -- sinking fund
  monthly_cents         bigint check (monthly_cents > 0),                   -- monthly hold-back
  due_month             date,                                               -- sinking fund payment month
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  unique (user_id, id),
  check ((kind = 'emergency_fund' and target_months is not null)
      or (kind = 'sinking_fund'   and annual_cents is not null and monthly_cents is not null))
);

create table public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id        uuid not null,
  period_start   date not null check (extract(day from period_start) in (1, 16)),
  amount_cents   bigint not null check (amount_cents > 0),
  source_bucket  public.bucket_kind not null,          -- snapshot
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade
);

-- ---------- Net worth: monthly snapshots -------------------------------------
create table public.net_worth_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  snapshot_on       date not null check (extract(day from snapshot_on) = 1),
  assets_cents      bigint not null,
  liabilities_cents bigint not null check (liabilities_cents >= 0),
  net_worth_cents   bigint generated always as (assets_cents - liabilities_cents) stored,
  unique (user_id, snapshot_on)
);

-- ---------- updated_at triggers ----------------------------------------------
create trigger trg_user_settings_updated before update on public.user_settings      for each row execute function public.set_updated_at();
create trigger trg_accounts_updated      before update on public.accounts           for each row execute function public.set_updated_at();
create trigger trg_incomes_updated       before update on public.incomes            for each row execute function public.set_updated_at();
create trigger trg_recurring_updated     before update on public.recurring_expenses for each row execute function public.set_updated_at();
create trigger trg_expenses_updated      before update on public.expenses           for each row execute function public.set_updated_at();
