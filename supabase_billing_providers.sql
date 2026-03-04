-- =========================================================
-- Billing providers (Stripe / KOMOJU) schema
-- =========================================================
-- This migration adds provider-customer and provider-subscription tables.
-- App-side trial control is retained (no provider trial settings).

begin;

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'komoju')),
  provider_customer_id text not null,
  email text,
  unique (store_id, user_id, provider),
  unique (provider, provider_customer_id)
);

create index if not exists idx_billing_customers_store_id on public.billing_customers(store_id);
create index if not exists idx_billing_customers_user_id on public.billing_customers(user_id);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'komoju')),
  billing_customer_id uuid references public.billing_customers(id) on delete set null,
  provider_subscription_id text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  trial_end timestamptz,
  current_period_end timestamptz,
  unique (store_id, provider),
  unique (provider, provider_subscription_id)
);

create index if not exists idx_billing_subscriptions_store_id on public.billing_subscriptions(store_id);
create index if not exists idx_billing_subscriptions_status on public.billing_subscriptions(status);

alter table public.store_subscriptions
  add column if not exists preferred_provider text
  check (preferred_provider in ('stripe', 'komoju'));

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid references public.stores(id) on delete set null,
  provider text not null check (provider in ('stripe', 'komoju')),
  event_type text not null,
  event_id text,
  signature text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error_message text
);

create index if not exists idx_billing_webhook_events_provider_created_at
  on public.billing_webhook_events(provider, created_at desc);

alter table public.billing_webhook_events
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create table if not exists public.billing_notification_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null,
  channel text not null default 'email' check (channel in ('email')),
  target text not null,
  sent_at timestamptz not null default now(),
  unique (store_id, kind, channel, target)
);

create index if not exists idx_billing_notification_logs_store_id
  on public.billing_notification_logs(store_id);

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'komoju')),
  idempotency_key text not null,
  checkout_session_id text,
  checkout_url text,
  status text not null default 'created' check (status in ('created', 'completed', 'expired', 'failed')),
  expires_at timestamptz,
  unique (store_id, user_id, provider, idempotency_key)
);

create index if not exists idx_billing_checkout_sessions_reuse
  on public.billing_checkout_sessions(store_id, user_id, provider, status, expires_at desc);

create table if not exists public.billing_status_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text check (provider in ('stripe', 'komoju')),
  from_status text,
  to_status text not null,
  source text not null check (source in ('checkout', 'webhook', 'cron', 'manual')),
  reason text,
  provider_subscription_id text,
  payload jsonb
);

create index if not exists idx_billing_status_history_store_id_created_at
  on public.billing_status_history(store_id, created_at desc);

create table if not exists public.billing_operations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'komoju')),
  provider_subscription_id text,
  operation_type text not null check (operation_type in ('cancel_immediately', 'cancel_at_period_end', 'refund_request')),
  amount_jpy integer check (amount_jpy is null or amount_jpy >= 0),
  reason text,
  status text not null default 'requested' check (status in ('requested', 'succeeded', 'failed')),
  result_message text
);

create index if not exists idx_billing_operations_store_id_created_at
  on public.billing_operations(store_id, created_at desc);

alter table public.store_subscriptions
  add column if not exists preferred_provider text
  check (preferred_provider in ('stripe', 'komoju'));

-- =========================================================
-- RLS hardening for billing tables
-- =========================================================
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_notification_logs enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_status_history enable row level security;
alter table public.billing_operations enable row level security;

create or replace function public.is_store_owner(target_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = target_store_id
      and sm.user_id = auth.uid()
      and sm.role = 'owner'
      and sm.is_active = true
  );
$$;

drop policy if exists billing_customers_owner_all on public.billing_customers;
create policy billing_customers_owner_all on public.billing_customers
  for all to authenticated
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

drop policy if exists billing_subscriptions_owner_all on public.billing_subscriptions;
create policy billing_subscriptions_owner_all on public.billing_subscriptions
  for all to authenticated
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

drop policy if exists billing_webhook_events_owner_select on public.billing_webhook_events;
create policy billing_webhook_events_owner_select on public.billing_webhook_events
  for select to authenticated
  using (store_id is not null and public.is_store_owner(store_id));

drop policy if exists billing_notification_logs_owner_select on public.billing_notification_logs;
create policy billing_notification_logs_owner_select on public.billing_notification_logs
  for select to authenticated
  using (public.is_store_owner(store_id));

drop policy if exists billing_checkout_sessions_owner_all on public.billing_checkout_sessions;
create policy billing_checkout_sessions_owner_all on public.billing_checkout_sessions
  for all to authenticated
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

drop policy if exists billing_status_history_owner_select on public.billing_status_history;
create policy billing_status_history_owner_select on public.billing_status_history
  for select to authenticated
  using (public.is_store_owner(store_id));

drop policy if exists billing_operations_owner_all on public.billing_operations;
create policy billing_operations_owner_all on public.billing_operations
  for all to authenticated
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

commit;
