-- =========================================================
-- Groomer App: Multi-store RLS policies
-- =========================================================
-- Prerequisite:
-- - Apply supabase_multistore_migration.sql first
-- =========================================================

begin;

-- Helper function: current user store IDs
create or replace function public.current_user_store_ids()
returns setof uuid
language sql
stable
as $$
  select sm.store_id
  from public.store_memberships sm
  where sm.user_id = auth.uid()
    and sm.is_active = true
$$;

-- stores and memberships tables
alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;

drop policy if exists stores_select_member on public.stores;
create policy stores_select_member
on public.stores
for select
to authenticated
using (id in (select public.current_user_store_ids()));

drop policy if exists memberships_select_self on public.store_memberships;
create policy memberships_select_self
on public.store_memberships
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists memberships_update_self on public.store_memberships;
create policy memberships_update_self
on public.store_memberships
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Business tables scoped by store_id
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers',
    'service_menus',
    'pets',
    'staffs',
    'appointments',
    'appointment_menus',
    'visits',
    'visit_menus',
    'payments',
    'medical_records',
    'medical_record_photos',
    'medical_record_videos',
    'medical_record_ai_pro_insights',
    'medical_record_share_links',
    'member_portal_links'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t || '_select_store', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (store_id in (select public.current_user_store_ids()));',
      t || '_select_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_insert_store', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (store_id in (select public.current_user_store_ids()));',
      t || '_insert_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_update_store', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (store_id in (select public.current_user_store_ids())) with check (store_id in (select public.current_user_store_ids()));',
      t || '_update_store',
      t
    );

    execute format('drop policy if exists %I on public.%I;', t || '_delete_store', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (store_id in (select public.current_user_store_ids()));',
      t || '_delete_store',
      t
    );
  end loop;
end $$;

commit;
