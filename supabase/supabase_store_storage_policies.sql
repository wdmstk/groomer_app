begin;

create table if not exists public.store_storage_policies (
  store_id uuid primary key references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  policy text not null default 'block' check (policy in ('block', 'cleanup_orphans')),
  extra_capacity_gb integer not null default 0 check (extra_capacity_gb >= 0),
  custom_limit_mb integer check (custom_limit_mb is null or custom_limit_mb >= 0)
);

alter table public.store_storage_policies enable row level security;

drop policy if exists store_storage_policies_owner_all on public.store_storage_policies;
create policy store_storage_policies_owner_all on public.store_storage_policies
  for all to authenticated
  using (public.is_store_owner(store_id))
  with check (public.is_store_owner(store_id));

commit;
