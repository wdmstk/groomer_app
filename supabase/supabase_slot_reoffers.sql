begin;

create table if not exists public.slot_waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  desired_from timestamptz,
  desired_to timestamptz,
  preferred_menu text,
  preferred_staff_id uuid references public.staffs(id) on delete set null,
  channel text not null default 'manual' check (channel in ('manual', 'line', 'phone')),
  notes text
);

create table if not exists public.slot_reoffers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  target_customer_id uuid references public.customers(id) on delete set null,
  target_pet_id uuid references public.pets(id) on delete set null,
  target_staff_id uuid references public.staffs(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'expired', 'canceled')),
  sent_at timestamptz,
  accepted_at timestamptz,
  notes text
);

create index if not exists idx_slot_reoffers_store_status_created
  on public.slot_reoffers(store_id, status, created_at desc);

create table if not exists public.slot_reoffer_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slot_reoffer_id uuid references public.slot_reoffers(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('slot_opened', 'candidate_selected', 'sent', 'accepted', 'expired', 'canceled', 'appointment_created')),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_slot_reoffer_logs_store_appointment_created
  on public.slot_reoffer_logs(store_id, appointment_id, created_at desc);

alter table public.slot_waitlist_requests enable row level security;
alter table public.slot_reoffers enable row level security;
alter table public.slot_reoffer_logs enable row level security;

drop policy if exists slot_waitlist_requests_select_store on public.slot_waitlist_requests;
create policy slot_waitlist_requests_select_store
on public.slot_waitlist_requests
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_waitlist_requests_insert_store on public.slot_waitlist_requests;
create policy slot_waitlist_requests_insert_store
on public.slot_waitlist_requests
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_waitlist_requests_update_store on public.slot_waitlist_requests;
create policy slot_waitlist_requests_update_store
on public.slot_waitlist_requests
for update to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_waitlist_requests_delete_store on public.slot_waitlist_requests;
create policy slot_waitlist_requests_delete_store
on public.slot_waitlist_requests
for delete to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_reoffers_select_store on public.slot_reoffers;
create policy slot_reoffers_select_store
on public.slot_reoffers
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_reoffers_insert_store on public.slot_reoffers;
create policy slot_reoffers_insert_store
on public.slot_reoffers
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_reoffers_update_store on public.slot_reoffers;
create policy slot_reoffers_update_store
on public.slot_reoffers
for update to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_reoffers_delete_store on public.slot_reoffers;
create policy slot_reoffers_delete_store
on public.slot_reoffers
for delete to authenticated
using (
  public.current_user_store_role(store_id) in ('owner', 'admin')
);

drop policy if exists slot_reoffer_logs_select_store on public.slot_reoffer_logs;
create policy slot_reoffer_logs_select_store
on public.slot_reoffer_logs
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_reoffer_logs_insert_store on public.slot_reoffer_logs;
create policy slot_reoffer_logs_insert_store
on public.slot_reoffer_logs
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists slot_reoffer_logs_update_store on public.slot_reoffer_logs;
create policy slot_reoffer_logs_update_store
on public.slot_reoffer_logs
for update to authenticated
using (
  public.current_user_store_role(store_id) in ('owner', 'admin')
)
with check (
  public.current_user_store_role(store_id) in ('owner', 'admin')
);

drop policy if exists slot_reoffer_logs_delete_store on public.slot_reoffer_logs;
create policy slot_reoffer_logs_delete_store
on public.slot_reoffer_logs
for delete to authenticated
using (
  public.current_user_store_role(store_id) in ('owner', 'admin')
);

commit;
