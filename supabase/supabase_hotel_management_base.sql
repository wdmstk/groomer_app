begin;

create table if not exists public.hotel_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  pricing_mode text not null check (pricing_mode in ('per_night', 'per_hour', 'flat')),
  base_amount_jpy integer not null default 0 check (base_amount_jpy >= 0),
  hourly_unit_minutes integer check (hourly_unit_minutes is null or hourly_unit_minutes > 0),
  hourly_unit_amount_jpy integer check (hourly_unit_amount_jpy is null or hourly_unit_amount_jpy >= 0),
  overtime_unit_minutes integer check (overtime_unit_minutes is null or overtime_unit_minutes > 0),
  overtime_unit_amount_jpy integer check (overtime_unit_amount_jpy is null or overtime_unit_amount_jpy >= 0),
  pickup_amount_jpy integer not null default 0 check (pickup_amount_jpy >= 0),
  dropoff_amount_jpy integer not null default 0 check (dropoff_amount_jpy >= 0),
  holiday_surcharge_amount_jpy integer not null default 0 check (holiday_surcharge_amount_jpy >= 0),
  effective_start_date date,
  effective_end_date date,
  is_active boolean not null default true,
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  check (
    pricing_mode <> 'per_hour'
    or (hourly_unit_minutes is not null and hourly_unit_amount_jpy is not null)
  ),
  check (
    effective_end_date is null
    or effective_start_date is null
    or effective_end_date >= effective_start_date
  )
);

create index if not exists idx_hotel_pricing_rules_store_active
  on public.hotel_pricing_rules(store_id, is_active, created_at desc);

create table if not exists public.hotel_stays (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  stay_code text not null,
  customer_id uuid references public.customers(id) on delete set null,
  pet_id uuid not null references public.pets(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  pricing_rule_id uuid references public.hotel_pricing_rules(id) on delete set null,
  status text not null default 'reserved'
    check (status in ('reserved', 'checked_in', 'checked_out', 'canceled', 'no_show')),
  planned_check_in_at timestamptz not null,
  planned_check_out_at timestamptz not null,
  actual_check_in_at timestamptz,
  actual_check_out_at timestamptz,
  nights integer not null default 1 check (nights >= 1 and nights <= 365),
  pickup_required boolean not null default false,
  dropoff_required boolean not null default false,
  pickup_scheduled_at timestamptz,
  dropoff_scheduled_at timestamptz,
  pickup_staff_id uuid references public.staffs(id) on delete set null,
  dropoff_staff_id uuid references public.staffs(id) on delete set null,
  vaccine_expires_on date,
  vaccine_verified_at timestamptz,
  vaccine_verified_by_user_id uuid references auth.users(id) on delete set null,
  total_amount_jpy integer not null default 0 check (total_amount_jpy >= 0),
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  unique (store_id, stay_code),
  check (planned_check_out_at > planned_check_in_at),
  check (
    actual_check_in_at is null
    or actual_check_out_at is null
    or actual_check_out_at >= actual_check_in_at
  )
);

create index if not exists idx_hotel_stays_store_status_checkin
  on public.hotel_stays(store_id, status, planned_check_in_at desc);

create index if not exists idx_hotel_stays_store_pet
  on public.hotel_stays(store_id, pet_id, created_at desc);

create table if not exists public.hotel_charges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  stay_id uuid not null references public.hotel_stays(id) on delete cascade,
  charge_type text not null
    check (
      charge_type in (
        'base',
        'extension',
        'transport_pickup',
        'transport_dropoff',
        'holiday_surcharge',
        'manual_adjustment',
        'discount'
      )
    ),
  label text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_amount_jpy integer not null default 0 check (unit_amount_jpy >= 0),
  line_amount_jpy integer not null,
  tax_rate numeric(4, 3) not null default 0.1 check (tax_rate >= 0 and tax_rate <= 1),
  tax_included boolean not null default true,
  applied_at timestamptz not null default now(),
  notes text,
  created_by_user_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_hotel_charges_store_stay_created
  on public.hotel_charges(store_id, stay_id, created_at desc);

alter table public.hotel_pricing_rules enable row level security;
alter table public.hotel_stays enable row level security;
alter table public.hotel_charges enable row level security;

drop policy if exists hotel_pricing_rules_select_store on public.hotel_pricing_rules;
create policy hotel_pricing_rules_select_store
on public.hotel_pricing_rules
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_pricing_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_pricing_rules_modify_owner_admin on public.hotel_pricing_rules;
create policy hotel_pricing_rules_modify_owner_admin
on public.hotel_pricing_rules
for all to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_pricing_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_pricing_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists hotel_stays_select_store on public.hotel_stays;
create policy hotel_stays_select_store
on public.hotel_stays
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stays.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_stays_insert_store on public.hotel_stays;
create policy hotel_stays_insert_store
on public.hotel_stays
for insert to authenticated
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stays.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_stays_update_store on public.hotel_stays;
create policy hotel_stays_update_store
on public.hotel_stays
for update to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stays.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stays.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_stays_delete_owner_admin on public.hotel_stays;
create policy hotel_stays_delete_owner_admin
on public.hotel_stays
for delete to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_stays.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists hotel_charges_select_store on public.hotel_charges;
create policy hotel_charges_select_store
on public.hotel_charges
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_charges.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_charges_insert_store on public.hotel_charges;
create policy hotel_charges_insert_store
on public.hotel_charges
for insert to authenticated
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_charges.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_charges_update_store on public.hotel_charges;
create policy hotel_charges_update_store
on public.hotel_charges
for update to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_charges.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_charges.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists hotel_charges_delete_owner_admin on public.hotel_charges;
create policy hotel_charges_delete_owner_admin
on public.hotel_charges
for delete to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hotel_charges.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

commit;
