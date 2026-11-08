-- =============================================================================
-- Spec 011 · FR-032: read-only preview of the conversion in migration 0011, to review with the
-- owner BEFORE applying it to the cloud. It only selects: no table is created or changed.
-- The cut-off expression is the same as private.legacy_statement_cut_off (0011), inlined because
-- that function doesn't exist yet when this runs.
-- =============================================================================
with p as (
  select a.name as card, a.cut_off_day, p.paid_on, p.amount_cents, p.paid_on - 1 as day
    from public.card_payments p
    join public.accounts a on a.user_id = p.user_id and a.id = p.card_account_id
   where a.cut_off_day is not null
),
m as (
  select *, date_trunc('month', day)::date as this_start,
            (date_trunc('month', day) - interval '1 month')::date as prev_start
    from p
),
c as (
  select *,
         make_date(extract(year from this_start)::int, extract(month from this_start)::int,
                   least(cut_off_day, extract(day from this_start + interval '1 month - 1 day')::int)) as this_cut,
         make_date(extract(year from prev_start)::int, extract(month from prev_start)::int,
                   least(cut_off_day, extract(day from prev_start + interval '1 month - 1 day')::int)) as prev_cut
    from m
)
select card,
       paid_on,
       amount_cents / 100.0                                          as amount_mxn,
       case when this_cut <= day then this_cut else prev_cut end    as marks_statement_of
  from c
 order by card, paid_on;
