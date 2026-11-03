-- 0006 · Ledger view exposes the expense subcategory (US8, FR-042: filter the ledger by category).
-- CREATE OR REPLACE VIEW may only append columns, so subcategory_id goes last. Grants and
-- security_invoker (RLS of the base tables applies) are kept by CREATE OR REPLACE.
create or replace view public.ledger_entries with (security_invoker = true) as
  select 'income'::text as entry_type, i.id, i.received_on as occurred_on, i.amount_cents as amount_cents,
         i.label as description, i.deposit_account_id as account_id, null::public.spend_bucket as bucket,
         false as is_third_party, null::uuid as subcategory_id
    from public.incomes i
  union all
  select case when e.origin = 'recurring' then 'recurring_expense' else 'expense' end, e.id, e.spent_on,
         -e.amount_cents, coalesce(e.note, ''), e.payment_account_id, e.bucket, false, e.subcategory_id
    from public.expenses e
  union all
  select 'card_payment', p.id, p.paid_on, -p.amount_cents, coalesce(p.note, ''), p.card_account_id, null, false,
         null
    from public.card_payments p
  union all
  select 'installment_collection', n.id, coalesce(n.collected_on, n.due_on), n.collected_cents, r.description,
         r.card_account_id, null, true, null
    from public.installments n
    join public.receivables r on r.id = n.receivable_id and r.user_id = n.user_id
   where n.collected_cents > 0;
