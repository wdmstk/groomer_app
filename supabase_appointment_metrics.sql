-- =========================================================
-- Groomer App: Appointment metrics table + RLS
-- =========================================================
-- Purpose:
-- - Persist reservation form KPI metrics per store.
-- - Track operational efficiency trends (time/clicks/changes).
-- =========================================================

begin;

create table if not exists public.appointment_metrics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  mode text not null check (mode in ('new', 'edit', 'unknown')),
  elapsed_ms integer not null default 0 check (elapsed_ms >= 0),
  click_count integer not null default 0 check (click_count >= 0),
  field_change_count integer not null default 0 check (field_change_count >= 0),
  selected_menu_count integer not null default 0 check (selected_menu_count >= 0),
  used_template_copy boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_appointment_metrics_store_created_at
  on public.appointment_metrics(store_id, created_at desc);

create index if not exists idx_appointment_metrics_store_event_type
  on public.appointment_metrics(store_id, event_type);

alter table public.appointment_metrics enable row level security;

drop policy if exists appointment_metrics_select_store on public.appointment_metrics;
create policy appointment_metrics_select_store
  on public.appointment_metrics
  for select
  to authenticated
  using (store_id in (select public.current_user_store_ids()));

drop policy if exists appointment_metrics_insert_store on public.appointment_metrics;
create policy appointment_metrics_insert_store
  on public.appointment_metrics
  for insert
  to authenticated
  with check (store_id in (select public.current_user_store_ids()));

drop policy if exists appointment_metrics_update_store on public.appointment_metrics;
create policy appointment_metrics_update_store
  on public.appointment_metrics
  for update
  to authenticated
  using (store_id in (select public.current_user_store_ids()))
  with check (store_id in (select public.current_user_store_ids()));

drop policy if exists appointment_metrics_delete_store on public.appointment_metrics;
create policy appointment_metrics_delete_store
  on public.appointment_metrics
  for delete
  to authenticated
  using (store_id in (select public.current_user_store_ids()));

commit;
