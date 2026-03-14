begin;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  description text,
  category text not null default 'general' check (
    category in ('general', 'bug', 'billing', 'feature_request', 'account', 'data_fix')
  ),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')
  ),
  source text not null default 'owner_portal' check (source in ('owner_portal', 'staff_portal', 'developer')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  unique (ticket_no)
);

create index if not exists idx_support_tickets_store_status_priority
  on public.support_tickets(store_id, status, priority, created_at desc);

create index if not exists idx_support_tickets_store_assigned_status
  on public.support_tickets(store_id, assigned_user_id, status, created_at desc);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'ticket_created',
      'status_changed',
      'priority_changed',
      'assigned',
      'note_added',
      'resolved',
      'closed',
      'reopened'
    )
  ),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_support_ticket_events_store_ticket_created
  on public.support_ticket_events(store_id, ticket_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_events enable row level security;

drop policy if exists support_tickets_select_store on public.support_tickets;
create policy support_tickets_select_store
on public.support_tickets
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists support_tickets_insert_store on public.support_tickets;
create policy support_tickets_insert_store
on public.support_tickets
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists support_tickets_update_store on public.support_tickets;
create policy support_tickets_update_store
on public.support_tickets
for update to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists support_tickets_delete_store on public.support_tickets;
create policy support_tickets_delete_store
on public.support_tickets
for delete to authenticated
using (
  public.current_user_store_role(store_id) in ('owner', 'admin')
);

drop policy if exists support_ticket_events_select_store on public.support_ticket_events;
create policy support_ticket_events_select_store
on public.support_ticket_events
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists support_ticket_events_insert_store on public.support_ticket_events;
create policy support_ticket_events_insert_store
on public.support_ticket_events
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists support_ticket_events_update_store on public.support_ticket_events;
create policy support_ticket_events_update_store
on public.support_ticket_events
for update to authenticated
using (public.current_user_store_role(store_id) in ('owner', 'admin'))
with check (public.current_user_store_role(store_id) in ('owner', 'admin'));

drop policy if exists support_ticket_events_delete_store on public.support_ticket_events;
create policy support_ticket_events_delete_store
on public.support_ticket_events
for delete to authenticated
using (public.current_user_store_role(store_id) in ('owner', 'admin'));

commit;
