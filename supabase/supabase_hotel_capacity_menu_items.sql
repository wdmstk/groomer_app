begin;

create table if not exists public.hotel_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  max_concurrent_pets integer not null default 1 check (max_concurrent_pets >= 1),
  calendar_open_hour integer check (calendar_open_hour is null or (calendar_open_hour >= 0 and calendar_open_hour <= 23)),
  calendar_close_hour integer check (calendar_close_hour is null or (calendar_close_hour >= 0 and calendar_close_hour <= 23)),
  unique (store_id)
);

create table if not exists public.hotel_menu_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  item_type text not null check (item_type in ('overnight', 'time_pack', 'option', 'transport', 'other')),
  billing_unit text not null check (billing_unit in ('per_stay', 'per_night', 'per_hour', 'fixed')),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  default_quantity numeric(10, 2) not null default 1 check (default_quantity > 0),
  price integer not null default 0 check (price >= 0),
  tax_rate numeric(4, 3) not null default 0.1 check (tax_rate >= 0 and tax_rate <= 1),
  tax_included boolean not null default true,
  counts_toward_capacity boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  notes text
);

create index if not exists idx_hotel_menu_items_store_active
  on public.hotel_menu_items(store_id, is_active, display_order asc, created_at desc);

create table if not exists public.hotel_stay_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  stay_id uuid not null references public.hotel_stays(id) on delete cascade,
  menu_item_id uuid references public.hotel_menu_items(id) on delete set null,
  item_type text not null,
  label_snapshot text not null,
  billing_unit_snapshot text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_snapshot integer not null default 0 check (unit_price_snapshot >= 0),
  line_amount_jpy integer not null,
  tax_rate_snapshot numeric(4, 3) not null default 0.1 check (tax_rate_snapshot >= 0 and tax_rate_snapshot <= 1),
  tax_included_snapshot boolean not null default true,
  counts_toward_capacity boolean not null default false,
  sort_order integer not null default 0,
  notes text
);

create index if not exists idx_hotel_stay_items_store_stay
  on public.hotel_stay_items(store_id, stay_id, sort_order asc, created_at asc);

alter table public.hotel_settings enable row level security;
alter table public.hotel_menu_items enable row level security;
alter table public.hotel_stay_items enable row level security;

drop policy if exists hotel_settings_select_store on public.hotel_settings;
create policy hotel_settings_select_store
on public.hotel_settings
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_settings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_settings_modify_owner_admin on public.hotel_settings;
create policy hotel_settings_modify_owner_admin
on public.hotel_settings
for all to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_settings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_settings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists hotel_menu_items_select_store on public.hotel_menu_items;
create policy hotel_menu_items_select_store
on public.hotel_menu_items
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_menu_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_menu_items_modify_owner_admin on public.hotel_menu_items;
create policy hotel_menu_items_modify_owner_admin
on public.hotel_menu_items
for all to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_menu_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_menu_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists hotel_stay_items_select_store on public.hotel_stay_items;
create policy hotel_stay_items_select_store
on public.hotel_stay_items
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stay_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_stay_items_insert_store on public.hotel_stay_items;
create policy hotel_stay_items_insert_store
on public.hotel_stay_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stay_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_stay_items_update_store on public.hotel_stay_items;
create policy hotel_stay_items_update_store
on public.hotel_stay_items
for update to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stay_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stay_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_stay_items_delete_owner_admin on public.hotel_stay_items;
create policy hotel_stay_items_delete_owner_admin
on public.hotel_stay_items
for delete to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stay_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

commit;
