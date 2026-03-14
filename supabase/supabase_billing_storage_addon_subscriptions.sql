begin;

alter table public.billing_subscriptions
  add column if not exists subscription_scope text not null default 'core'
  check (subscription_scope in ('core', 'storage_addon'));

alter table public.billing_subscriptions
  add column if not exists storage_addon_units integer not null default 0
  check (storage_addon_units >= 0);

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_store_id_provider_key;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_store_id_provider_scope_key
  unique (store_id, provider, subscription_scope);

create index if not exists idx_billing_subscriptions_scope
  on public.billing_subscriptions(subscription_scope);

alter table public.billing_checkout_sessions
  add column if not exists subscription_scope text not null default 'core'
  check (subscription_scope in ('core', 'storage_addon'));

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_store_id_user_id_provider_idempotency_key_key;

alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_store_user_provider_scope_idempotency_key
  unique (store_id, user_id, provider, subscription_scope, idempotency_key);

create index if not exists idx_billing_checkout_sessions_scope
  on public.billing_checkout_sessions(subscription_scope);

commit;
