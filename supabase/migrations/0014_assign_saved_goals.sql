-- =============================================================================
-- 0014 · Spec 014: use Saved (spec 013) in goals.
--  1. goal_kind gains 'purchase': a goal with a target amount and an optional target month
--     (the existing, unused due_month column), and no monthly contributions.
--     Postgres can't *use* an enum value added in the same transaction, so the CHECKs below
--     compare kind::text instead of the enum literal.
--  2. goals.completed_at: "I bought it". A completed goal is an archived purchase.
--  3. public.goal_saved_moves: Saved → goal (+) and goal → Saved (−) with a signed amount, so
--     every derived value is a plain sum. Several per goal and per quincena (goal_contributions
--     is unique per goal and period). Insert-only from the client; rows go away only in cascade
--     when their goal is deleted, which puts that money back in "Available to assign".
--     Available itself depends on Saved, which is derived on the client, so the caps (≤ available,
--     ≤ the goal's net) are validated there.
-- =============================================================================

alter type public.goal_kind add value if not exists 'purchase';

alter table public.goals
  add column target_cents bigint check (target_cents > 0),
  add column completed_at timestamptz,
  add constraint goals_due_month_first_day check (due_month is null or extract(day from due_month) = 1),
  drop constraint goals_check,
  add constraint goals_kind_shape check (
       (kind::text = 'emergency_fund' and target_months is not null)
    or (kind::text = 'sinking_fund'   and annual_cents is not null and monthly_cents is not null)
    or (kind::text = 'purchase'       and target_cents is not null and monthly_cents is null)
  ),
  add constraint goals_completed_purchase check (
    completed_at is null or (archived_at is not null and kind::text = 'purchase')
  );

comment on column public.goals.target_cents is 'Spec 014: purchase goal target amount.';
comment on column public.goals.completed_at is 'Spec 014: "I bought it" (purchase only, implies archived).';

create table public.goal_saved_moves (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id       uuid not null,
  moved_on      date not null,
  amount_cents  bigint not null check (amount_cents <> 0),   -- + assign, − return
  created_at    timestamptz not null default now(),
  foreign key (user_id, goal_id) references public.goals (user_id, id) on delete cascade
);
create index goal_saved_moves_user_goal_idx on public.goal_saved_moves (user_id, goal_id);

alter table public.goal_saved_moves enable row level security;
alter table public.goal_saved_moves force row level security;
revoke all on public.goal_saved_moves from anon, public;
grant select, insert on public.goal_saved_moves to authenticated;
-- Supabase's default privileges grant everything on new tables (see 0012); a move is never edited.
revoke update, delete, truncate, references, trigger on public.goal_saved_moves from authenticated;
create policy goal_saved_moves_owner on public.goal_saved_moves for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
