-- =========================================================
-- Groomer App: Store Subscription Table
-- =========================================================
-- Purpose:
-- - Manage per-store billing/subscription state for developer admin operations.
-- =========================================================

begin;

create table if not exists public.store_subscriptions (
  store_id uuid primary key references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  plan_code text not null default 'free',
  billing_status text not null default 'inactive'
    check (billing_status in ('inactive', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'yearly', 'custom')),
  preferred_provider text
    check (preferred_provider in ('stripe', 'komoju')),
  amount_jpy integer not null default 0 check (amount_jpy >= 0),
  current_period_start date,
  current_period_end date,
  next_billing_date date,
  trial_days integer not null default 30 check (trial_days >= 0),
  trial_started_at date not null default current_date,
  grace_days integer not null default 3 check (grace_days >= 0),
  past_due_since timestamptz,
  hotel_option_enabled boolean not null default false,
  notification_option_enabled boolean not null default false,
  notes text
);

alter table public.store_subscriptions
  add column if not exists trial_days integer not null default 30 check (trial_days >= 0);

alter table public.store_subscriptions
  add column if not exists trial_started_at date not null default current_date;

alter table public.store_subscriptions
  add column if not exists preferred_provider text
  check (preferred_provider in ('stripe', 'komoju'));

alter table public.store_subscriptions
  add column if not exists grace_days integer not null default 3 check (grace_days >= 0);

alter table public.store_subscriptions
  add column if not exists past_due_since timestamptz;

alter table public.store_subscriptions
  add column if not exists hotel_option_enabled boolean not null default false;

alter table public.store_subscriptions
  add column if not exists notification_option_enabled boolean not null default false;

create index if not exists idx_store_subscriptions_billing_status
  on public.store_subscriptions(billing_status);

commit;
