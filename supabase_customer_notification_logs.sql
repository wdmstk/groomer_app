begin;

create table if not exists public.customer_notification_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  slot_reoffer_id uuid references public.slot_reoffers(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('line', 'phone', 'manual', 'email')),
  notification_type text not null check (
    notification_type in ('slot_reoffer', 'followup', 'reminder', 'test_send', 'other')
  ),
  status text not null default 'sent' check (status in ('queued', 'sent', 'failed', 'canceled')),
  subject text,
  body text,
  target text,
  dedupe_key text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);

alter table public.customer_notification_logs
  add column if not exists target text;

alter table public.customer_notification_logs
  drop constraint if exists customer_notification_logs_channel_check;

alter table public.customer_notification_logs
  add constraint customer_notification_logs_channel_check
  check (channel in ('line', 'phone', 'manual', 'email'));

alter table public.customer_notification_logs
  drop constraint if exists customer_notification_logs_notification_type_check;

alter table public.customer_notification_logs
  add constraint customer_notification_logs_notification_type_check
  check (
    notification_type in ('slot_reoffer', 'followup', 'reminder', 'test_send', 'other')
  );

create index if not exists idx_customer_notification_logs_store_sent
  on public.customer_notification_logs(store_id, sent_at desc);

create index if not exists idx_customer_notification_logs_store_customer
  on public.customer_notification_logs(store_id, customer_id, sent_at desc);

create index if not exists idx_customer_notification_logs_store_target
  on public.customer_notification_logs(store_id, target, sent_at desc);

create unique index if not exists idx_customer_notification_logs_dedupe
  on public.customer_notification_logs(store_id, dedupe_key)
  where dedupe_key is not null;

alter table public.customer_notification_logs enable row level security;

drop policy if exists customer_notification_logs_select_store on public.customer_notification_logs;
create policy customer_notification_logs_select_store
on public.customer_notification_logs
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_notification_logs_insert_store on public.customer_notification_logs;
create policy customer_notification_logs_insert_store
on public.customer_notification_logs
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_notification_logs_update_store on public.customer_notification_logs;
create policy customer_notification_logs_update_store
on public.customer_notification_logs
for update to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_notification_logs_delete_store on public.customer_notification_logs;
create policy customer_notification_logs_delete_store
on public.customer_notification_logs
for delete to authenticated
using (store_id in (select public.current_user_store_ids()));

commit;
