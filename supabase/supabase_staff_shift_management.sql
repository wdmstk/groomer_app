begin;

create table if not exists public.store_shift_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  timezone text not null default 'Asia/Tokyo',
  default_open_time time,
  default_close_time time,
  late_grace_minutes integer not null default 10,
  early_leave_grace_minutes integer not null default 10,
  auto_shift_enabled boolean not null default false,
  attendance_punch_enabled boolean not null default true,
  attendance_location_required boolean not null default false,
  attendance_location_lat numeric(10, 7),
  attendance_location_lng numeric(10, 7),
  attendance_location_radius_meters integer not null default 200,
  shift_optimization_enabled boolean not null default false,
  scheduled_auto_run_enabled boolean not null default false,
  auto_shift_horizon_days integer not null default 14,
  policy_priority text not null default 'nomination_first'
    check (policy_priority in ('nomination_first', 'cost_first', 'fairness_first'))
);

alter table public.store_shift_settings
  add column if not exists attendance_punch_enabled boolean not null default true;
alter table public.store_shift_settings
  add column if not exists attendance_location_required boolean not null default false;
alter table public.store_shift_settings
  add column if not exists attendance_location_lat numeric(10, 7);
alter table public.store_shift_settings
  add column if not exists attendance_location_lng numeric(10, 7);
alter table public.store_shift_settings
  add column if not exists attendance_location_radius_meters integer not null default 200;
alter table public.store_shift_settings
  add column if not exists shift_optimization_enabled boolean not null default false;
alter table public.store_shift_settings
  add column if not exists scheduled_auto_run_enabled boolean not null default false;

create table if not exists public.store_closed_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  rule_type text not null check (rule_type in ('weekday', 'date')),
  weekday smallint check (weekday between 0 and 6),
  closed_date date,
  note text,
  is_active boolean not null default true,
  check (
    (rule_type = 'weekday' and weekday is not null and closed_date is null)
    or (rule_type = 'date' and weekday is null and closed_date is not null)
  )
);

create unique index if not exists store_closed_rules_store_weekday_uniq
  on public.store_closed_rules (store_id, weekday)
  where rule_type = 'weekday';

create unique index if not exists store_closed_rules_store_date_uniq
  on public.store_closed_rules (store_id, closed_date)
  where rule_type = 'date';

create table if not exists public.staff_work_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'part_time', 'arubaito')),
  weekly_max_minutes integer,
  max_consecutive_days integer,
  can_be_nominated boolean not null default true,
  preferred_shift_minutes integer,
  is_active boolean not null default true,
  unique (store_id, staff_id)
);

create table if not exists public.staff_work_rule_slots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_work_rule_id uuid not null references public.staff_work_rules(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create index if not exists staff_work_rule_slots_store_rule_weekday_idx
  on public.staff_work_rule_slots (store_id, staff_work_rule_id, weekday);

create table if not exists public.staff_shift_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  shift_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  planned_break_minutes integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  source_type text not null default 'manual' check (source_type in ('manual', 'auto', 'nomination_sync')),
  source_appointment_id uuid references public.appointments(id) on delete set null,
  note text,
  check (start_at < end_at)
);

create unique index if not exists staff_shift_plans_store_source_appointment_uniq
  on public.staff_shift_plans (store_id, source_appointment_id)
  where source_appointment_id is not null;

create index if not exists staff_shift_plans_store_date_idx
  on public.staff_shift_plans (store_id, shift_date);

create index if not exists staff_shift_plans_store_staff_date_idx
  on public.staff_shift_plans (store_id, staff_id, shift_date);

create table if not exists public.shift_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  alert_date date not null,
  alert_type text not null check (alert_type in ('nomination_uncovered', 'conflict', 'policy_violation')),
  severity text not null default 'warn' check (severity in ('info', 'warn', 'critical')),
  staff_id uuid references public.staffs(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  message text not null,
  resolved_at timestamptz
);

create index if not exists shift_alerts_store_date_idx
  on public.shift_alerts (store_id, alert_date);

create index if not exists shift_alerts_store_resolved_idx
  on public.shift_alerts (store_id, resolved_at);

create table if not exists public.staff_day_off_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  day_off_date date not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  note text,
  unique (store_id, staff_id, day_off_date)
);

create index if not exists staff_day_off_requests_store_date_idx
  on public.staff_day_off_requests (store_id, day_off_date, status);

create table if not exists public.shift_auto_generate_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  from_date date not null,
  to_date date not null,
  mode text not null check (mode in ('preview', 'apply_draft')),
  settings_snapshot jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb
);

create index if not exists shift_auto_generate_runs_store_created_idx
  on public.shift_auto_generate_runs (store_id, created_at desc);

create table if not exists public.shift_auto_generate_run_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id uuid not null references public.shift_auto_generate_runs(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  shift_date date,
  staff_id uuid references public.staffs(id) on delete set null,
  shift_plan_id uuid references public.staff_shift_plans(id) on delete set null,
  action_type text not null check (action_type in ('created', 'updated', 'deleted', 'skipped_manual', 'policy_violation')),
  message text,
  before_payload jsonb not null default '{}'::jsonb,
  after_payload jsonb not null default '{}'::jsonb
);

create index if not exists shift_auto_generate_run_items_run_idx
  on public.shift_auto_generate_run_items (run_id, created_at);

create table if not exists public.shift_optimization_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  fairness_weight numeric(5, 4) not null default 0.3500 check (fairness_weight >= 0 and fairness_weight <= 1),
  preferred_shift_weight numeric(5, 4) not null default 0.2500 check (preferred_shift_weight >= 0 and preferred_shift_weight <= 1),
  reservation_coverage_weight numeric(5, 4) not null default 0.3000 check (reservation_coverage_weight >= 0 and reservation_coverage_weight <= 1),
  workload_health_weight numeric(5, 4) not null default 0.1000 check (workload_health_weight >= 0 and workload_health_weight <= 1),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  check (
    abs(
      (fairness_weight + preferred_shift_weight + reservation_coverage_weight + workload_health_weight) - 1.0
    ) <= 0.0001
  )
);

create table if not exists public.shift_scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  is_active boolean not null default true,
  frequency text not null check (frequency in ('daily', 'weekly')),
  run_at_local_time time not null,
  run_weekday smallint check (run_weekday between 0 and 6),
  target_horizon_days integer not null check (target_horizon_days between 1 and 90),
  mode text not null default 'apply_draft' check (mode in ('apply_draft')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  check (
    (frequency = 'daily' and run_weekday is null)
    or (frequency = 'weekly' and run_weekday is not null)
  )
);

create index if not exists shift_scheduled_jobs_store_active_idx
  on public.shift_scheduled_jobs (store_id, is_active, updated_at desc);

create table if not exists public.shift_scheduled_job_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  job_id uuid not null references public.shift_scheduled_jobs(id) on delete cascade,
  status text not null check (status in ('success', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  run_id uuid references public.shift_auto_generate_runs(id) on delete set null,
  error_summary text
);

create index if not exists shift_scheduled_job_runs_store_started_idx
  on public.shift_scheduled_job_runs (store_id, started_at desc);

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  business_date date not null,
  event_type text not null check (event_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  occurred_at timestamptz not null,
  location_lat numeric(10, 7),
  location_lng numeric(10, 7),
  location_accuracy_meters numeric(10, 2),
  location_captured_at timestamptz,
  location_is_within_radius boolean,
  source_type text not null default 'self' check (source_type in ('self', 'admin_adjust', 'approved_request')),
  shift_plan_id uuid references public.staff_shift_plans(id) on delete set null
);

alter table public.attendance_events
  add column if not exists location_lat numeric(10, 7);
alter table public.attendance_events
  add column if not exists location_lng numeric(10, 7);
alter table public.attendance_events
  add column if not exists location_accuracy_meters numeric(10, 2);
alter table public.attendance_events
  add column if not exists location_captured_at timestamptz;
alter table public.attendance_events
  add column if not exists location_is_within_radius boolean;

create index if not exists attendance_events_store_staff_date_idx
  on public.attendance_events (store_id, staff_id, business_date, occurred_at);

create table if not exists public.attendance_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  business_date date not null,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_minutes integer not null default 0,
  worked_minutes integer not null default 0,
  status text not null default 'incomplete' check (status in ('complete', 'incomplete', 'needs_review')),
  flags jsonb not null default '{}'::jsonb,
  unique (store_id, staff_id, business_date)
);

create index if not exists attendance_daily_summaries_store_date_idx
  on public.attendance_daily_summaries (store_id, business_date, staff_id);

create table if not exists public.attendance_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staffs(id) on delete cascade,
  business_date date not null,
  requested_payload jsonb not null default '{}'::jsonb,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists attendance_adjustment_requests_store_status_idx
  on public.attendance_adjustment_requests (store_id, status, business_date);

create table if not exists public.attendance_punch_block_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  attempted_by_user_id uuid references auth.users(id) on delete set null,
  target_staff_id uuid references public.staffs(id) on delete set null,
  event_type text check (event_type in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  business_date date,
  occurred_at timestamptz,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists attendance_punch_block_logs_store_created_idx
  on public.attendance_punch_block_logs (store_id, created_at desc);

alter table public.store_shift_settings enable row level security;
alter table public.store_closed_rules enable row level security;
alter table public.staff_work_rules enable row level security;
alter table public.staff_work_rule_slots enable row level security;
alter table public.staff_shift_plans enable row level security;
alter table public.shift_alerts enable row level security;
alter table public.staff_day_off_requests enable row level security;
alter table public.shift_auto_generate_runs enable row level security;
alter table public.shift_auto_generate_run_items enable row level security;
alter table public.shift_optimization_profiles enable row level security;
alter table public.shift_scheduled_jobs enable row level security;
alter table public.shift_scheduled_job_runs enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_daily_summaries enable row level security;
alter table public.attendance_adjustment_requests enable row level security;
alter table public.attendance_punch_block_logs enable row level security;

drop policy if exists store_shift_settings_select_store on public.store_shift_settings;
create policy store_shift_settings_select_store
on public.store_shift_settings
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_shift_settings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists store_shift_settings_modify_owner_admin on public.store_shift_settings;
create policy store_shift_settings_modify_owner_admin
on public.store_shift_settings
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_shift_settings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_shift_settings.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists store_closed_rules_select_store on public.store_closed_rules;
create policy store_closed_rules_select_store
on public.store_closed_rules
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_closed_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists store_closed_rules_modify_owner_admin on public.store_closed_rules;
create policy store_closed_rules_modify_owner_admin
on public.store_closed_rules
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_closed_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = store_closed_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists staff_work_rules_select_store on public.staff_work_rules;
create policy staff_work_rules_select_store
on public.staff_work_rules
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_work_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists staff_work_rules_modify_owner_admin on public.staff_work_rules;
create policy staff_work_rules_modify_owner_admin
on public.staff_work_rules
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_work_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_work_rules.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists staff_work_rule_slots_select_store on public.staff_work_rule_slots;
create policy staff_work_rule_slots_select_store
on public.staff_work_rule_slots
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_work_rule_slots.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists staff_work_rule_slots_modify_owner_admin on public.staff_work_rule_slots;
create policy staff_work_rule_slots_modify_owner_admin
on public.staff_work_rule_slots
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_work_rule_slots.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_work_rule_slots.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists staff_shift_plans_select_store on public.staff_shift_plans;
create policy staff_shift_plans_select_store
on public.staff_shift_plans
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_shift_plans.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists staff_shift_plans_modify_owner_admin on public.staff_shift_plans;
create policy staff_shift_plans_modify_owner_admin
on public.staff_shift_plans
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_shift_plans.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_shift_plans.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists shift_alerts_select_store on public.shift_alerts;
create policy shift_alerts_select_store
on public.shift_alerts
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists shift_alerts_modify_owner_admin on public.shift_alerts;
create policy shift_alerts_modify_owner_admin
on public.shift_alerts
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_alerts.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists staff_day_off_requests_select_store on public.staff_day_off_requests;
create policy staff_day_off_requests_select_store
on public.staff_day_off_requests
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_day_off_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists staff_day_off_requests_modify_owner_admin on public.staff_day_off_requests;
create policy staff_day_off_requests_modify_owner_admin
on public.staff_day_off_requests
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_day_off_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = staff_day_off_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists shift_auto_generate_runs_select_store on public.shift_auto_generate_runs;
create policy shift_auto_generate_runs_select_store
on public.shift_auto_generate_runs
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_auto_generate_runs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists shift_auto_generate_runs_modify_owner_admin on public.shift_auto_generate_runs;
create policy shift_auto_generate_runs_modify_owner_admin
on public.shift_auto_generate_runs
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_auto_generate_runs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_auto_generate_runs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists shift_auto_generate_run_items_select_store on public.shift_auto_generate_run_items;
create policy shift_auto_generate_run_items_select_store
on public.shift_auto_generate_run_items
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_auto_generate_run_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists shift_auto_generate_run_items_modify_owner_admin on public.shift_auto_generate_run_items;
create policy shift_auto_generate_run_items_modify_owner_admin
on public.shift_auto_generate_run_items
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_auto_generate_run_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_auto_generate_run_items.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists shift_optimization_profiles_select_store on public.shift_optimization_profiles;
create policy shift_optimization_profiles_select_store
on public.shift_optimization_profiles
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_optimization_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists shift_optimization_profiles_modify_owner_admin on public.shift_optimization_profiles;
create policy shift_optimization_profiles_modify_owner_admin
on public.shift_optimization_profiles
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_optimization_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_optimization_profiles.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists shift_scheduled_jobs_select_store on public.shift_scheduled_jobs;
create policy shift_scheduled_jobs_select_store
on public.shift_scheduled_jobs
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_scheduled_jobs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists shift_scheduled_jobs_modify_owner_admin on public.shift_scheduled_jobs;
create policy shift_scheduled_jobs_modify_owner_admin
on public.shift_scheduled_jobs
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_scheduled_jobs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_scheduled_jobs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists shift_scheduled_job_runs_select_store on public.shift_scheduled_job_runs;
create policy shift_scheduled_job_runs_select_store
on public.shift_scheduled_job_runs
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_scheduled_job_runs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists shift_scheduled_job_runs_modify_owner_admin on public.shift_scheduled_job_runs;
create policy shift_scheduled_job_runs_modify_owner_admin
on public.shift_scheduled_job_runs
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_scheduled_job_runs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = shift_scheduled_job_runs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_events_select_store on public.attendance_events;
create policy attendance_events_select_store
on public.attendance_events
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_events.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_events_insert_store on public.attendance_events;
create policy attendance_events_insert_store
on public.attendance_events
for insert to authenticated
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_events.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_events_modify_owner_admin on public.attendance_events;
create policy attendance_events_modify_owner_admin
on public.attendance_events
for update to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_events.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_events.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_daily_summaries_select_store on public.attendance_daily_summaries;
create policy attendance_daily_summaries_select_store
on public.attendance_daily_summaries
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_daily_summaries.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_daily_summaries_modify_owner_admin on public.attendance_daily_summaries;
create policy attendance_daily_summaries_modify_owner_admin
on public.attendance_daily_summaries
for all to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_daily_summaries.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_daily_summaries.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_adjustment_requests_select_store on public.attendance_adjustment_requests;
create policy attendance_adjustment_requests_select_store
on public.attendance_adjustment_requests
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_adjustment_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_adjustment_requests_insert_store on public.attendance_adjustment_requests;
create policy attendance_adjustment_requests_insert_store
on public.attendance_adjustment_requests
for insert to authenticated
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_adjustment_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists attendance_adjustment_requests_modify_owner_admin on public.attendance_adjustment_requests;
create policy attendance_adjustment_requests_modify_owner_admin
on public.attendance_adjustment_requests
for update to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_adjustment_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_adjustment_requests.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_punch_block_logs_select_owner_admin on public.attendance_punch_block_logs;
create policy attendance_punch_block_logs_select_owner_admin
on public.attendance_punch_block_logs
for select to authenticated
using (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_punch_block_logs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

drop policy if exists attendance_punch_block_logs_insert_store_member on public.attendance_punch_block_logs;
create policy attendance_punch_block_logs_insert_store_member
on public.attendance_punch_block_logs
for insert to authenticated
with check (
  exists (
    select 1 from public.store_memberships sm
    where sm.store_id = attendance_punch_block_logs.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

commit;
