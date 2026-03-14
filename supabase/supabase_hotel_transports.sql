begin;

create table if not exists public.hotel_transports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  stay_id uuid not null references public.hotel_stays(id) on delete cascade,
  transport_type text not null check (transport_type in ('pickup', 'dropoff')),
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'dispatched', 'in_transit', 'arrived', 'completed', 'canceled')),
  scheduled_at timestamptz,
  dispatched_at timestamptz,
  in_transit_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  staff_id uuid references public.staffs(id) on delete set null,
  source_address text,
  destination_address text,
  contact_name text,
  contact_phone text,
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (stay_id, transport_type)
);

create index if not exists idx_hotel_transports_store_status_scheduled
  on public.hotel_transports(store_id, status, scheduled_at desc);

create index if not exists idx_hotel_transports_store_type_created
  on public.hotel_transports(store_id, transport_type, created_at desc);

create table if not exists public.hotel_transport_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  transport_id uuid not null references public.hotel_transports(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (
      event_type in (
        'created',
        'updated',
        'status_changed',
        'assigned',
        'rescheduled',
        'canceled',
        'deleted'
      )
    ),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_hotel_transport_logs_store_transport_created
  on public.hotel_transport_logs(store_id, transport_id, created_at desc);

alter table public.hotel_transports enable row level security;
alter table public.hotel_transport_logs enable row level security;

drop policy if exists hotel_transports_select_store on public.hotel_transports;
create policy hotel_transports_select_store
on public.hotel_transports
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_transports.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_transports_modify_store_member on public.hotel_transports;
create policy hotel_transports_modify_store_member
on public.hotel_transports
for all to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_transports.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_transports.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_transport_logs_select_store on public.hotel_transport_logs;
create policy hotel_transport_logs_select_store
on public.hotel_transport_logs
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_transport_logs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_transport_logs_insert_store_member on public.hotel_transport_logs;
create policy hotel_transport_logs_insert_store_member
on public.hotel_transport_logs
for insert to authenticated
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_transport_logs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

commit;
