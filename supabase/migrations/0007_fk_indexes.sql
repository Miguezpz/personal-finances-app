-- 0007 · Covering indexes for the composite foreign keys (T153, Supabase advisor
-- 0001_unindexed_foreign_keys). Every FK is (user_id, <ref>) → (user_id, id): without an index on
-- the referencing side, deleting or checking a referenced row (archiving an account, deleting a
-- subcategory "with movements", cascading a user's deletion) scans the whole child table.
-- (user_id, x) also covers the plain user_id FKs of goal_contributions and investment_subrules.
create index if not exists card_payments_user_card_idx        on public.card_payments (user_id, card_account_id);
create index if not exists card_payments_user_from_idx        on public.card_payments (user_id, from_account_id);
create index if not exists expenses_user_payment_account_idx  on public.expenses (user_id, payment_account_id);
create index if not exists expenses_user_recurring_idx        on public.expenses (user_id, recurring_expense_id);
create index if not exists expenses_user_subcategory_idx      on public.expenses (user_id, subcategory_id);
create index if not exists goal_contributions_user_goal_idx   on public.goal_contributions (user_id, goal_id);
create index if not exists income_allocations_user_account_idx on public.income_allocations (user_id, account_id);
create index if not exists income_allocations_user_income_idx on public.income_allocations (user_id, income_id);
create index if not exists incomes_user_deposit_account_idx   on public.incomes (user_id, deposit_account_id);
create index if not exists installments_user_receivable_idx   on public.installments (user_id, receivable_id);
create index if not exists investment_subrules_user_account_idx on public.investment_subrules (user_id, account_id);
create index if not exists investment_subrules_user_rule_idx  on public.investment_subrules (user_id, rule_id);
create index if not exists receivables_user_card_idx          on public.receivables (user_id, card_account_id);
create index if not exists receivables_user_debtor_idx        on public.receivables (user_id, debtor_id);
create index if not exists recurring_expenses_user_account_idx on public.recurring_expenses (user_id, payment_account_id);
create index if not exists recurring_expenses_user_subcategory_idx on public.recurring_expenses (user_id, subcategory_id);
create index if not exists subcategories_user_category_idx    on public.subcategories (user_id, category_id);
