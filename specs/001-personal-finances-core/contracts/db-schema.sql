-- =============================================================================
-- Personal Finances Core — esquema relacional de referencia (PostgreSQL / Supabase)
-- Fuente de diseño para las migraciones en supabase/migrations/*.sql
-- Convenciones:
--   * Dinero: bigint en CENTAVOS de MXN. Porcentajes: smallint en puntos base (0–10000).
--   * Fechas de negocio: `date` (sin hora). Zona horaria del usuario en user_settings.
--   * Toda tabla de datos lleva user_id + RLS; las FK entre tablas son compuestas (user_id, id).
--   * La BD NO calcula lógica de negocio: solo valida invariantes (rangos y sumas exactas).
-- =============================================================================

-- ---------- Tipos ------------------------------------------------------------
create type bucket_kind        as enum ('needs', 'wants', 'investment');
create type spend_bucket       as enum ('needs', 'wants');
create type account_kind       as enum ('checking', 'savings', 'credit_card', 'investment', 'cash');
create type expense_origin     as enum ('manual', 'recurring');
create type installment_status as enum ('pending', 'partial', 'collected');
create type goal_kind          as enum ('emergency_fund', 'sinking_fund');

-- ---------- Utilidades -------------------------------------------------------
create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Configuración del usuario ----------------------------------------
create table user_settings (
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

-- ---------- Catálogo: cuentas, tarjetas y plataformas ------------------------
create table accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                     account_kind not null,
  name                     text not null check (char_length(name) between 1 and 60),
  institution              text check (char_length(institution) <= 60),
  cut_off_day              smallint check (cut_off_day between 1 and 31),            -- tarjetas
  payment_due_offset_days  smallint check (payment_due_offset_days between 1 and 60), -- días tras el corte
  opening_balance_cents    bigint not null default 0,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name),
  check (kind <> 'credit_card' or (cut_off_day is not null and payment_due_offset_days is not null))
);

-- ---------- Reglas de distribución (versionadas por vigencia) -----------------
create table distribution_rules (
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

create table investment_subrules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id     uuid not null,
  account_id  uuid not null,                          -- vehículo (cuenta tipo investment)
  pct_bps     smallint not null check (pct_bps between 1 and 10000),
  unique (rule_id, account_id),
  foreign key (user_id, rule_id)    references distribution_rules (user_id, id) on delete cascade,
  foreign key (user_id, account_id) references accounts (user_id, id)
);

-- ---------- Taxonomía de gasto ----------------------------------------------
create table categories (               -- Categoría padre (hereda el macro Needs/Wants)
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  name_key    text,                      -- clave i18n para categorías por defecto
  macro       spend_bucket not null,
  archived_at timestamptz,
  unique (user_id, id),
  unique (user_id, name)
);

create table subcategories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  name        text not null check (char_length(name) between 1 and 60),
  name_key    text,
  archived_at timestamptz,
  unique (user_id, id),
  unique (category_id, name),
  foreign key (user_id, category_id) references categories (user_id, id) on delete restrict
);

-- ---------- Ingresos y asignaciones -----------------------------------------
create table incomes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label                text not null check (char_length(label) between 1 and 80),
  amount_cents         bigint not null check (amount_cents > 0),
  received_on          date not null,
  funded_period_start  date not null check (extract(day from funded_period_start) in (1, 16)),
  is_recurring         boolean not null default true,
  distributed          boolean not null default true,       -- false = registrado sin repartir
  rule_id              uuid,                                 -- regla aplicada (instantánea)
  deposit_account_id   uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, rule_id)            references distribution_rules (user_id, id),
  foreign key (user_id, deposit_account_id) references accounts (user_id, id)
);
create index incomes_user_received_idx on incomes (user_id, received_on);

create table income_allocations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  income_id     uuid not null,
  bucket        bucket_kind not null,
  account_id    uuid,                                        -- vehículo si bucket = investment
  amount_cents  bigint not null check (amount_cents >= 0),
  period_start  date not null check (extract(day from period_start) in (1, 16)),
  foreign key (user_id, income_id)  references incomes  (user_id, id) on delete cascade,
  foreign key (user_id, account_id) references accounts (user_id, id),
  check ((bucket = 'investment') = (account_id is not null))
);
create index income_allocations_period_idx on income_allocations (user_id, period_start, bucket);

-- ---------- Gastos fijos y gastos ------------------------------------------
create table recurring_expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 80),
  amount_cents       bigint not null check (amount_cents > 0),
  charge_day         smallint not null check (charge_day between 1 and 31),
  subcategory_id     uuid not null,
  bucket             spend_bucket not null,                  -- instantánea de la categoría padre
  payment_account_id uuid,
  starts_on          date not null,
  ended_on           date,                                   -- pausa/fin; NULL = vigente
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, subcategory_id)     references subcategories (user_id, id),
  foreign key (user_id, payment_account_id) references accounts (user_id, id),
  check (ended_on is null or ended_on >= starts_on)
);

create table expenses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount_cents          bigint not null check (amount_cents > 0),
  spent_on              date not null,
  subcategory_id        uuid not null,
  bucket                spend_bucket not null,               -- instantánea heredada de la categoría
  payment_account_id    uuid,                                -- si es tarjeta de crédito, incrementa su deuda
  note                  text check (char_length(note) <= 200),
  origin                expense_origin not null default 'manual',
  recurring_expense_id  uuid,
  occurrence_date       date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, subcategory_id)       references subcategories      (user_id, id),
  foreign key (user_id, payment_account_id)   references accounts           (user_id, id),
  foreign key (user_id, recurring_expense_id) references recurring_expenses (user_id, id) on delete set null,
  check ((origin = 'recurring') = (recurring_expense_id is not null and occurrence_date is not null))
);
create index expenses_user_spent_idx on expenses (user_id, spent_on);
-- Idempotencia de la materialización de fijos (FR-010)
create unique index expenses_recurring_occurrence_uq
  on expenses (recurring_expense_id, occurrence_date) where recurring_expense_id is not null;

-- ---------- Tarjetas: pagos (liquidación de deuda; no tocan bolsas) -----------
create table card_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_account_id  uuid not null,
  from_account_id  uuid,
  amount_cents     bigint not null check (amount_cents > 0),
  paid_on          date not null,
  note             text check (char_length(note) <= 200),
  created_at       timestamptz not null default now(),
  foreign key (user_id, card_account_id) references accounts (user_id, id),
  foreign key (user_id, from_account_id) references accounts (user_id, id)
);
create index card_payments_user_paid_idx on card_payments (user_id, paid_on);

-- ---------- Cuentas por cobrar (MSI a terceros) ------------------------------
create table debtors (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name     text not null check (char_length(name) between 1 and 80),
  unique (user_id, id),
  unique (user_id, name)
);

create table receivables (
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
  foreign key (user_id, debtor_id)       references debtors  (user_id, id),
  foreign key (user_id, card_account_id) references accounts (user_id, id)
);

create table installments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  receivable_id    uuid not null,
  seq              smallint not null check (seq >= 1),
  due_on           date not null,                -- fecha sugerida de cobro al deudor
  card_due_on      date not null,                -- límite de pago de la tarjeta de esa mensualidad
  amount_cents     bigint not null check (amount_cents > 0),
  collected_cents  bigint not null default 0,
  collected_on     date,
  status           installment_status not null default 'pending',
  unique (receivable_id, seq),
  foreign key (user_id, receivable_id) references receivables (user_id, id) on delete cascade,
  check (collected_cents between 0 and amount_cents),
  check (status = case
                    when collected_cents = 0            then 'pending'::installment_status
                    when collected_cents < amount_cents then 'partial'::installment_status
                    else 'collected'::installment_status
                  end)
);
create index installments_user_due_idx on installments (user_id, due_on) where status <> 'collected';

-- ---------- Metas: fondo de emergencia y apartados ---------------------------
create table goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                  goal_kind not null,
  name                  text not null check (char_length(name) between 1 and 80),
  source_bucket         bucket_kind not null,          -- de qué bolsa salen las aportaciones
  target_months         smallint check (target_months between 1 and 36),   -- fondo de emergencia
  annual_cents          bigint check (annual_cents > 0),                    -- apartado
  monthly_cents         bigint check (monthly_cents > 0),                   -- retención mensual
  due_month             date,                                               -- mes de pago del apartado
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  unique (user_id, id),
  check ((kind = 'emergency_fund' and target_months is not null)
      or (kind = 'sinking_fund'   and annual_cents is not null and monthly_cents is not null))
);

create table goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id        uuid not null,
  period_start   date not null check (extract(day from period_start) in (1, 16)),
  amount_cents   bigint not null check (amount_cents > 0),
  source_bucket  bucket_kind not null,                -- instantánea
  unique (goal_id, period_start),                     -- idempotencia
  foreign key (user_id, goal_id) references goals (user_id, id) on delete cascade
);

-- ---------- Patrimonio neto: instantáneas mensuales --------------------------
create table net_worth_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  snapshot_on       date not null check (extract(day from snapshot_on) = 1),
  assets_cents      bigint not null,
  liabilities_cents bigint not null check (liabilities_cents >= 0),
  net_worth_cents   bigint generated always as (assets_cents - liabilities_cents) stored,
  unique (user_id, snapshot_on)
);

-- ---------- Triggers de updated_at ------------------------------------------
create trigger trg_user_settings_updated   before update on user_settings      for each row execute function set_updated_at();
create trigger trg_accounts_updated        before update on accounts           for each row execute function set_updated_at();
create trigger trg_incomes_updated         before update on incomes            for each row execute function set_updated_at();
create trigger trg_recurring_updated       before update on recurring_expenses for each row execute function set_updated_at();
create trigger trg_expenses_updated        before update on expenses           for each row execute function set_updated_at();

-- ---------- Invariantes de suma exacta (triggers diferidos) ------------------
-- Verificadores reutilizables: se invocan desde ambos lados de la relación (cabecera y detalle),
-- de modo que ni un ingreso sin asignaciones ni un UPDATE del monto eluden la validación.
create function check_income_allocations(p_income uuid) returns void
language plpgsql as $$
declare v_total bigint; v_dist boolean; v_sum bigint;
begin
  select amount_cents, distributed into v_total, v_dist from incomes where id = p_income;
  if not found then return; end if;                          -- ingreso eliminado en cascada
  select coalesce(sum(amount_cents), 0) into v_sum from income_allocations where income_id = p_income;
  if v_dist and v_sum <> v_total then
    raise exception 'allocations sum % <> income amount %', v_sum, v_total using errcode = '23514';
  end if;
  if not v_dist and v_sum <> 0 then
    raise exception 'income not distributed must have no allocations' using errcode = '23514';
  end if;
end $$;

create function trg_allocations_sum_fn() returns trigger
language plpgsql as $$
begin
  perform check_income_allocations(coalesce(new.income_id, old.income_id));
  return null;
end $$;
create constraint trigger trg_allocations_sum
  after insert or update or delete on income_allocations
  deferrable initially deferred for each row execute function trg_allocations_sum_fn();

create function trg_income_total_fn() returns trigger
language plpgsql as $$
begin
  perform check_income_allocations(new.id);
  return null;
end $$;
create constraint trigger trg_income_total
  after insert or update of amount_cents, distributed on incomes
  deferrable initially deferred for each row execute function trg_income_total_fn();

create function check_receivable_installments(p_receivable uuid) returns void
language plpgsql as $$
declare v_total bigint; v_n smallint; v_sum bigint; v_count integer;
begin
  select total_cents, term_months into v_total, v_n from receivables where id = p_receivable;
  if not found then return; end if;
  select coalesce(sum(amount_cents), 0), count(*) into v_sum, v_count from installments where receivable_id = p_receivable;
  if v_sum <> v_total then
    raise exception 'installments sum % <> receivable total %', v_sum, v_total using errcode = '23514';
  end if;
  if v_count <> v_n then
    raise exception 'installments count % <> term_months %', v_count, v_n using errcode = '23514';
  end if;
end $$;

create function trg_installments_sum_fn() returns trigger
language plpgsql as $$
begin
  perform check_receivable_installments(coalesce(new.receivable_id, old.receivable_id));
  return null;
end $$;
create constraint trigger trg_installments_sum
  after insert or update or delete on installments
  deferrable initially deferred for each row execute function trg_installments_sum_fn();

create function trg_receivable_total_fn() returns trigger
language plpgsql as $$
begin
  perform check_receivable_installments(new.id);
  return null;
end $$;
create constraint trigger trg_receivable_total
  after insert or update of total_cents, term_months on receivables
  deferrable initially deferred for each row execute function trg_receivable_total_fn();

create function assert_subrules_sum() returns trigger
language plpgsql as $$
declare v_rule uuid := coalesce(new.rule_id, old.rule_id);
        v_inv smallint; v_sum integer;
begin
  select investment_bps into v_inv from distribution_rules where id = v_rule;
  if not found then return null; end if;
  select coalesce(sum(pct_bps), 0) into v_sum from investment_subrules where rule_id = v_rule;
  if v_inv > 0 and v_sum <> 10000 then
    raise exception 'investment sub-rules must sum to 10000 bps (got %)', v_sum using errcode = '23514';
  end if;
  if v_inv = 0 and v_sum <> 0 then
    raise exception 'sub-rules require investment_bps > 0' using errcode = '23514';
  end if;
  return null;
end $$;
create constraint trigger trg_subrules_sum
  after insert or update or delete on investment_subrules
  deferrable initially deferred for each row execute function assert_subrules_sum();

-- ---------- RPC transaccionales (SECURITY INVOKER: respetan RLS) -------------
-- Solo insertan cabecera + detalle de forma atómica; no calculan lógica de negocio.
create function register_income(p_income jsonb, p_allocations jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into incomes (label, amount_cents, received_on, funded_period_start, is_recurring, distributed, rule_id, deposit_account_id)
  values (p_income ->> 'label',
          (p_income ->> 'amount_cents')::bigint,
          (p_income ->> 'received_on')::date,
          (p_income ->> 'funded_period_start')::date,
          coalesce((p_income ->> 'is_recurring')::boolean, true),
          coalesce((p_income ->> 'distributed')::boolean, true),
          nullif(p_income ->> 'rule_id', '')::uuid,
          nullif(p_income ->> 'deposit_account_id', '')::uuid)
  returning id into v_id;

  insert into income_allocations (income_id, bucket, account_id, amount_cents, period_start)
  select v_id, (a ->> 'bucket')::bucket_kind, nullif(a ->> 'account_id', '')::uuid,
         (a ->> 'amount_cents')::bigint, (a ->> 'period_start')::date
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as a;

  return v_id;          -- la suma exacta se valida al hacer COMMIT (trigger diferido)
end $$;

create function create_receivable(p_receivable jsonb, p_installments jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into receivables (debtor_id, card_account_id, description, total_cents, term_months, purchase_date)
  values ((p_receivable ->> 'debtor_id')::uuid, (p_receivable ->> 'card_account_id')::uuid,
          p_receivable ->> 'description', (p_receivable ->> 'total_cents')::bigint,
          (p_receivable ->> 'term_months')::smallint, (p_receivable ->> 'purchase_date')::date)
  returning id into v_id;

  insert into installments (receivable_id, seq, due_on, card_due_on, amount_cents)
  select v_id, (i ->> 'seq')::smallint, (i ->> 'due_on')::date, (i ->> 'card_due_on')::date, (i ->> 'amount_cents')::bigint
  from jsonb_array_elements(p_installments) as i;

  return v_id;
end $$;

create function save_distribution_rule(p_rule jsonb, p_subrules jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  -- Una regla ya usada por ingresos no se reescribe (preserva la instantánea de FR-005).
  if exists (select 1 from distribution_rules r
               join incomes i on i.rule_id = r.id and i.user_id = r.user_id
              where r.effective_from = (p_rule ->> 'effective_from')::date) then
    raise exception 'rule effective on % is already used by incomes; use a later effective_from',
      p_rule ->> 'effective_from' using errcode = '23505';
  end if;

  insert into distribution_rules (effective_from, needs_bps, wants_bps, investment_bps)
  values ((p_rule ->> 'effective_from')::date, (p_rule ->> 'needs_bps')::smallint,
          (p_rule ->> 'wants_bps')::smallint, (p_rule ->> 'investment_bps')::smallint)
  on conflict (user_id, effective_from) do update
    set needs_bps = excluded.needs_bps, wants_bps = excluded.wants_bps, investment_bps = excluded.investment_bps
  returning id into v_id;

  delete from investment_subrules where rule_id = v_id;
  insert into investment_subrules (rule_id, account_id, pct_bps)
  select v_id, (s ->> 'account_id')::uuid, (s ->> 'pct_bps')::smallint
  from jsonb_array_elements(coalesce(p_subrules, '[]'::jsonb)) as s;

  return v_id;
end $$;

-- ---------- Bitácora unificada (vista; respeta RLS del invocador) --------------
create view ledger_entries with (security_invoker = true) as
  select 'income'::text as entry_type, i.id, i.received_on as occurred_on, i.amount_cents as amount_cents,
         i.label as description, null::uuid as account_id, null::spend_bucket as bucket, false as is_third_party
    from incomes i
  union all
  select case when e.origin = 'recurring' then 'recurring_expense' else 'expense' end, e.id, e.spent_on,
         -e.amount_cents, coalesce(e.note, ''), e.payment_account_id, e.bucket, false
    from expenses e
  union all
  select 'card_payment', p.id, p.paid_on, -p.amount_cents, coalesce(p.note, ''), p.card_account_id, null, false
    from card_payments p
  union all
  select 'installment_collection', n.id, coalesce(n.collected_on, n.due_on), n.collected_cents, r.description,
         r.card_account_id, null, true
    from installments n join receivables r on r.id = n.receivable_id and r.user_id = n.user_id
   where n.collected_cents > 0;

-- ---------- RLS ----------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','accounts','distribution_rules','investment_subrules','categories','subcategories',
    'incomes','income_allocations','recurring_expenses','expenses','card_payments','debtors',
    'receivables','installments','goals','goal_contributions','net_worth_snapshots']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format($p$create policy %I on %I for all to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()))$p$, t || '_owner', t);
  end loop;
end $$;

revoke all on ledger_entries from anon;
grant select on ledger_entries to authenticated;
revoke execute on function register_income, create_receivable, save_distribution_rule from public, anon;
grant  execute on function register_income, create_receivable, save_distribution_rule to authenticated;
