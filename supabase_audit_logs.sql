begin;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_logs_store_created
  on public.audit_logs(store_id, created_at desc);

create index if not exists idx_audit_logs_store_entity
  on public.audit_logs(store_id, entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_store on public.audit_logs;
create policy audit_logs_select_store
on public.audit_logs
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists audit_logs_insert_store on public.audit_logs;
create policy audit_logs_insert_store
on public.audit_logs
for insert to authenticated
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists audit_logs_update_store on public.audit_logs;
create policy audit_logs_update_store
on public.audit_logs
for update to authenticated
using (store_id in (select public.current_user_store_ids()))
with check (store_id in (select public.current_user_store_ids()));

drop policy if exists audit_logs_delete_store on public.audit_logs;
create policy audit_logs_delete_store
on public.audit_logs
for delete to authenticated
using (store_id in (select public.current_user_store_ids()));

commit;
