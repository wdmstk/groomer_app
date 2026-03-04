-- =========================================================
-- RLS hardening for store_memberships / store_subscriptions
-- =========================================================
-- Purpose:
-- - Prevent arbitrary self-update on store_memberships
-- - Align store_subscriptions access with owner-only billing model
-- =========================================================

begin;

create or replace function public.current_user_owned_store_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select sm.store_id
  from public.store_memberships sm
  where sm.user_id = auth.uid()
    and sm.is_active = true
    and sm.role = 'owner'
$$;

create or replace function public.is_store_owner(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = target_store_id
      and sm.user_id = auth.uid()
      and sm.role = 'owner'
      and sm.is_active = true
  );
$$;

alter table public.store_memberships enable row level security;

drop policy if exists memberships_update_self on public.store_memberships;

drop policy if exists memberships_select_owner_store on public.store_memberships;
create policy memberships_select_owner_store
on public.store_memberships
for select
to authenticated
using (store_id in (select public.current_user_owned_store_ids()));

drop policy if exists memberships_update_owner_store on public.store_memberships;
create policy memberships_update_owner_store
on public.store_memberships
for update
to authenticated
using (store_id in (select public.current_user_owned_store_ids()))
with check (store_id in (select public.current_user_owned_store_ids()));

alter table public.store_subscriptions enable row level security;

drop policy if exists store_subscriptions_owner_select on public.store_subscriptions;
create policy store_subscriptions_owner_select
on public.store_subscriptions
for select
to authenticated
using (public.is_store_owner(store_id));

commit;
