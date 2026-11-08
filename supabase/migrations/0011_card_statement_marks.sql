-- =============================================================================
-- 0011 · Spec 011: "Ya la pagué" — card payments become per-statement marks (no amount).
--  1. public.card_statement_marks: one row per card and cut-off the owner marked as paid.
--     Composite FK (user_id, card_account_id) like every other table (accounts are archived, never
--     deleted while referenced); unique per cut-off, so marking twice is a no-op.
--  2. RLS pattern of 0005/0009: enable + force, owner policy, nothing for anon. No UPDATE grant:
--     a mark is only created or removed.
--  3. private.legacy_statement_cut_off(cut_off_day, paid_on): the statement an old amount-based
--     payment was paying — the latest cut-off strictly before the payment date. Same rule as
--     src/domain/legacy-card-payments.ts; also used by supabase/queries/preview-card-marks.sql.
--  4. Conversion: every card_payments row becomes the mark of that statement (FR-018). Amounts
--     are dropped, so an old over-payment no longer covers later statements (FR-019).
--     card_payments itself is kept untouched (and unused by the app) until the conversion is
--     verified; the ledger_entries view is not used by the app and is left as is.
-- =============================================================================

create table public.card_statement_marks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_account_id  uuid not null,
  cut_off          date not null,
  marked_at        timestamptz not null default now(),
  unique (user_id, card_account_id, cut_off),
  foreign key (user_id, card_account_id) references public.accounts (user_id, id)
);

alter table public.card_statement_marks enable row level security;
alter table public.card_statement_marks force row level security;
revoke all on public.card_statement_marks from anon, public;
grant select, insert, delete on public.card_statement_marks to authenticated;
create policy card_statement_marks_owner on public.card_statement_marks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- Legacy conversion -------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.legacy_statement_cut_off(p_cut_off_day int, p_paid_on date)
returns date
language sql
immutable
as $$
  with x as (select p_paid_on - 1 as day),
  months as (
    select day,
           date_trunc('month', day)::date                         as this_start,
           (date_trunc('month', day) - interval '1 month')::date as prev_start
      from x
  ),
  cut as (
    select day,
           make_date(extract(year from this_start)::int, extract(month from this_start)::int,
                     least(p_cut_off_day,
                           extract(day from this_start + interval '1 month - 1 day')::int)) as this_cut,
           make_date(extract(year from prev_start)::int, extract(month from prev_start)::int,
                     least(p_cut_off_day,
                           extract(day from prev_start + interval '1 month - 1 day')::int)) as prev_cut
      from months
  )
  select case when this_cut <= day then this_cut else prev_cut end from cut
$$;

revoke execute on function private.legacy_statement_cut_off(int, date) from public, anon, authenticated;

insert into public.card_statement_marks (user_id, card_account_id, cut_off)
select distinct p.user_id, p.card_account_id,
       private.legacy_statement_cut_off(a.cut_off_day, p.paid_on)
  from public.card_payments p
  join public.accounts a on a.user_id = p.user_id and a.id = p.card_account_id
 where a.cut_off_day is not null
on conflict (user_id, card_account_id, cut_off) do nothing;
