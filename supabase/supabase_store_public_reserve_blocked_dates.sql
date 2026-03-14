begin;

create table if not exists public.store_public_reserve_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  date_key date not null,
  reason text,
  is_active boolean not null default true
);

create unique index if not exists store_public_reserve_blocked_dates_store_date_uniq
  on public.store_public_reserve_blocked_dates (store_id, date_key);

create index if not exists store_public_reserve_blocked_dates_store_date_idx
  on public.store_public_reserve_blocked_dates (store_id, date_key);

alter table public.store_public_reserve_blocked_dates enable row level security;

drop policy if exists store_public_reserve_blocked_dates_select_store
  on public.store_public_reserve_blocked_dates;
create policy store_public_reserve_blocked_dates_select_store
on public.store_public_reserve_blocked_dates
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_public_reserve_blocked_dates.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists store_public_reserve_blocked_dates_modify_owner_admin
  on public.store_public_reserve_blocked_dates;
create policy store_public_reserve_blocked_dates_modify_owner_admin
on public.store_public_reserve_blocked_dates
for all to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_public_reserve_blocked_dates.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_public_reserve_blocked_dates.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

commit;
