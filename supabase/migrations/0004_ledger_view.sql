-- =============================================================================
-- 0004 · Unified ledger view (T022). security_invoker = true → the caller's RLS applies.
-- Signed amounts: incomes and third-party collections positive, outflows negative (MXN cents).
-- =============================================================================

create view public.ledger_entries with (security_invoker = true) as
  select 'income'::text as entry_type, i.id, i.received_on as occurred_on, i.amount_cents as amount_cents,
         i.label as description, i.deposit_account_id as account_id, null::public.spend_bucket as bucket,
         false as is_third_party
    from public.incomes i
  union all
  select case when e.origin = 'recurring' then 'recurring_expense' else 'expense' end, e.id, e.spent_on,
         -e.amount_cents, coalesce(e.note, ''), e.payment_account_id, e.bucket, false
    from public.expenses e
  union all
  select 'card_payment', p.id, p.paid_on, -p.amount_cents, coalesce(p.note, ''), p.card_account_id, null, false
    from public.card_payments p
  union all
  select 'installment_collection', n.id, coalesce(n.collected_on, n.due_on), n.collected_cents, r.description,
         r.card_account_id, null, true
    from public.installments n
    join public.receivables r on r.id = n.receivable_id and r.user_id = n.user_id
   where n.collected_cents > 0;
