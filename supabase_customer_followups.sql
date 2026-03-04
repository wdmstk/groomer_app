begin;

create table if not exists public.customer_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  source_appointment_id uuid references public.appointments(id) on delete set null,
  last_visit_at timestamptz not null,
  recommended_at timestamptz not null,
  status text not null default 'open' check (
    status in (
      'open',
      'in_progress',
      'snoozed',
      'resolved_booked',
      'resolved_no_need',
      'resolved_lost'
    )
  ),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_on date,
  snoozed_until timestamptz,
  assigned_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_type text check (
    resolution_type in ('booked', 'declined', 'unreachable', 'no_need', 'other')
  ),
  resolution_note text,
  last_contacted_at timestamptz,
  last_contact_method text check (last_contact_method in ('phone', 'line', 'manual', 'other')),
  unique (store_id, customer_id, pet_id, recommended_at)
);

create index if not exists idx_customer_followup_tasks_store_status_recommended
  on public.customer_followup_tasks(store_id, status, recommended_at desc);

create index if not exists idx_customer_followup_tasks_store_assignee_status
  on public.customer_followup_tasks(store_id, assigned_user_id, status);

create index if not exists idx_customer_followup_tasks_store_snoozed_until
  on public.customer_followup_tasks(store_id, snoozed_until);

create table if not exists public.customer_followup_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  task_id uuid not null references public.customer_followup_tasks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'task_created',
      'status_changed',
      'contacted_phone',
      'contacted_line',
      'note_added',
      'snoozed',
      'resolved',
      'appointment_created'
    )
  ),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_customer_followup_events_store_task_created
  on public.customer_followup_events(store_id, task_id, created_at desc);

alter table public.customer_followup_tasks enable row level security;
alter table public.customer_followup_events enable row level security;

drop policy if exists customer_followup_tasks_select_store on public.customer_followup_tasks;
create policy customer_followup_tasks_select_store
on public.customer_followup_tasks
for select
to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_tasks_insert_store on public.customer_followup_tasks;
create policy customer_followup_tasks_insert_store
on public.customer_followup_tasks
for insert
to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_tasks_update_store on public.customer_followup_tasks;
create policy customer_followup_tasks_update_store
on public.customer_followup_tasks
for update
to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_tasks_delete_store on public.customer_followup_tasks;
create policy customer_followup_tasks_delete_store
on public.customer_followup_tasks
for delete
to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_events_select_store on public.customer_followup_events;
create policy customer_followup_events_select_store
on public.customer_followup_events
for select
to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_events_insert_store on public.customer_followup_events;
create policy customer_followup_events_insert_store
on public.customer_followup_events
for insert
to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_events_update_store on public.customer_followup_events;
create policy customer_followup_events_update_store
on public.customer_followup_events
for update
to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists customer_followup_events_delete_store on public.customer_followup_events;
create policy customer_followup_events_delete_store
on public.customer_followup_events
for delete
to authenticated
using (store_id in (select public.current_user_store_ids()));

commit;
