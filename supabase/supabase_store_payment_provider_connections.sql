begin;

create table if not exists public.store_payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'komoju')),
  is_active boolean not null default false,
  secret_key text,
  webhook_secret text,
  komoju_api_base_url text,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (store_id, provider)
);

create index if not exists idx_store_payment_provider_connections_store_id
  on public.store_payment_provider_connections(store_id);

alter table public.store_payment_provider_connections enable row level security;

drop policy if exists store_payment_provider_connections_select_store on public.store_payment_provider_connections;
create policy store_payment_provider_connections_select_store
on public.store_payment_provider_connections
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists store_payment_provider_connections_modify_owner_admin on public.store_payment_provider_connections;
create policy store_payment_provider_connections_modify_owner_admin
on public.store_payment_provider_connections
for all to authenticated
using (public.current_user_store_role(store_id) in ('owner', 'admin'))
with check (public.current_user_store_role(store_id) in ('owner', 'admin'));

commit;
