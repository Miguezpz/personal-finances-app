-- =============================================================================
-- 0009 · Spec 005: quick expenses (one-tap expense templates).
--
--  * expense_templates: name, amount, subcategory and optional payment method of an expense the
--    owner repeats. A tap creates a normal manual expense; the expense does NOT reference the
--    template, so editing or deleting a template never touches the history (FR-002).
--  * No bucket column: the bucket is taken from the subcategory's category at tap time (FR-003).
--  * Deleting is logical (archived = true). The 12-active limit is a client-side safeguard for the
--    Dashboard row, not a data invariant (research R7).
--  * Composite FKs (user_id, …) so a template can't point to another user's subcategory or account,
--    and the RLS pattern of 0005 (enable + force, owner policy, nothing for anon).
-- =============================================================================

create table public.expense_templates (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 40),
  amount_cents       bigint not null check (amount_cents > 0),
  subcategory_id     uuid not null,
  payment_account_id uuid,
  sort               smallint not null default 0 check (sort >= 0),
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, subcategory_id)     references public.subcategories (user_id, id),
  foreign key (user_id, payment_account_id) references public.accounts (user_id, id)
);

create trigger trg_expense_templates_updated before update on public.expense_templates
  for each row execute function public.set_updated_at();

-- FK indexes (pattern of 0007) and the Dashboard row order.
create index expense_templates_user_subcategory_idx on public.expense_templates (user_id, subcategory_id);
create index expense_templates_user_account_idx     on public.expense_templates (user_id, payment_account_id);
create index expense_templates_user_sort_idx        on public.expense_templates (user_id, sort) where not archived;

-- ---------- RLS (pattern of 0005) -------------------------------------------
alter table public.expense_templates enable row level security;
alter table public.expense_templates force row level security;
revoke all on public.expense_templates from anon, public;
grant select, insert, update, delete on public.expense_templates to authenticated;
create policy expense_templates_owner on public.expense_templates for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
