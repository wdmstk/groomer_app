begin;

-- v1.2: attendance leave / balance / monthly closing / alerts

create table if not exists public.attendance_leave_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  target_date date not null,
  request_type text not null check (request_type in ('paid_leave', 'half_leave_am', 'half_leave_pm', 'special_leave', 'absence')),
  reason text not null,
  requested_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'returned')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists attendance_leave_requests_store_staff_date_idx
  on public.attendance_leave_requests (store_id, staff_id, target_date, created_at desc);

create index if not exists attendance_leave_requests_store_status_idx
  on public.attendance_leave_requests (store_id, status, target_date);

create unique index if not exists attendance_leave_requests_pending_uniq
  on public.attendance_leave_requests (store_id, staff_id, target_date)
  where status = 'pending';

create table if not exists public.staff_leave_balances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  leave_type text not null check (leave_type in ('paid_leave')),
  granted_days numeric(5,2) not null default 0,
  used_days numeric(5,2) not null default 0,
  carry_over_days numeric(5,2) not null default 0,
  expired_days numeric(5,2) not null default 0,
  remaining_days numeric(5,2) not null default 0,
  effective_from date not null,
  effective_to date not null,
  check (effective_from <= effective_to)
);

create unique index if not exists staff_leave_balances_store_staff_type_period_uniq
  on public.staff_leave_balances (store_id, staff_id, leave_type, effective_from, effective_to);

create index if not exists staff_leave_balances_store_staff_idx
  on public.staff_leave_balances (store_id, staff_id, leave_type);

create table if not exists public.attendance_monthly_closings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  target_month text not null check (target_month ~ '^\d{4}-\d{2}$'),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by_user_id uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  reopened_by_user_id uuid references auth.users(id) on delete set null,
  reopened_at timestamptz
);

create unique index if not exists attendance_monthly_closings_store_month_uniq
  on public.attendance_monthly_closings (store_id, target_month);

create table if not exists public.attendance_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid references public.staffs(id) on delete set null,
  business_date date,
  alert_type text not null check (alert_type in ('missing_punch', 'approval_stale', 'overtime_limit', 'consecutive_limit', 'absence_unresolved')),
  severity text not null default 'warn' check (severity in ('info', 'warn', 'critical')),
  message text not null,
  resolved_at timestamptz
);

create index if not exists attendance_alerts_store_date_idx
  on public.attendance_alerts (store_id, business_date);

create index if not exists attendance_alerts_store_resolved_idx
  on public.attendance_alerts (store_id, resolved_at);

-- Optional helper index for flags query (v1.2)
create index if not exists attendance_daily_summaries_flags_gin_idx
  on public.attendance_daily_summaries using gin (flags);

alter table public.attendance_leave_requests enable row level security;
alter table public.staff_leave_balances enable row level security;
alter table public.attendance_monthly_closings enable row level security;
alter table public.attendance_alerts enable row level security;

drop policy if exists attendance_leave_requests_select_store on public.attendance_leave_requests;
create policy attendance_leave_requests_select_store
on public.attendance_leave_requests
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_leave_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_leave_requests_insert_store on public.attendance_leave_requests;
create policy attendance_leave_requests_insert_store
on public.attendance_leave_requests
for insert to authenticated
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_leave_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_leave_requests_modify_owner_admin on public.attendance_leave_requests;
create policy attendance_leave_requests_modify_owner_admin
on public.attendance_leave_requests
for update to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_leave_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_leave_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists staff_leave_balances_select_store on public.staff_leave_balances;
create policy staff_leave_balances_select_store
on public.staff_leave_balances
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_leave_balances.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists staff_leave_balances_modify_owner_admin on public.staff_leave_balances;
create policy staff_leave_balances_modify_owner_admin
on public.staff_leave_balances
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_leave_balances.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_leave_balances.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_monthly_closings_select_store on public.attendance_monthly_closings;
create policy attendance_monthly_closings_select_store
on public.attendance_monthly_closings
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_monthly_closings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_monthly_closings_modify_owner_admin on public.attendance_monthly_closings;
create policy attendance_monthly_closings_modify_owner_admin
on public.attendance_monthly_closings
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_monthly_closings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_monthly_closings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_alerts_select_store on public.attendance_alerts;
create policy attendance_alerts_select_store
on public.attendance_alerts
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_alerts_modify_owner_admin on public.attendance_alerts;
create policy attendance_alerts_modify_owner_admin
on public.attendance_alerts
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

commit;
