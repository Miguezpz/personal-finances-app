-- Spec 013: optional "save the leftover" setting. Saved itself is derived on the client.
alter table public.user_settings
  add column save_surplus boolean not null default false;
comment on column public.user_settings.save_surplus is
  'Spec 013: true = the positive closing of each quincena goes to Saved instead of carrying over.';
