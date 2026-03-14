begin;

create table if not exists public.hq_menu_template_deliveries (
  id uuid primary key default gen_random_uuid(),
  source_store_id uuid not null references public.stores(id) on delete cascade,
  target_store_ids uuid[] not null,
  overwrite_scope text not null
    check (overwrite_scope in ('price_duration_only', 'full')),
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'rejected')),
  requested_by_user_id uuid not null references auth.users(id),
  approved_by_user_ids uuid[] not null default '{}',
  applied_at timestamptz,
  applied_summary jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hq_menu_template_deliveries_source_store_id
  on public.hq_menu_template_deliveries(source_store_id);

create index if not exists idx_hq_menu_template_deliveries_status
  on public.hq_menu_template_deliveries(status);

create table if not exists public.hq_menu_template_delivery_approvals (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.hq_menu_template_deliveries(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  approver_user_id uuid not null references auth.users(id),
  approver_role text not null
    check (approver_role in ('owner', 'admin')),
  status text not null
    check (status in ('approved', 'rejected')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_id, store_id)
);

create index if not exists idx_hq_menu_template_delivery_approvals_delivery_id
  on public.hq_menu_template_delivery_approvals(delivery_id);

alter table public.hq_menu_template_deliveries enable row level security;
alter table public.hq_menu_template_delivery_approvals enable row level security;

drop policy if exists hq_menu_template_deliveries_select_policy
  on public.hq_menu_template_deliveries;
create policy hq_menu_template_deliveries_select_policy
on public.hq_menu_template_deliveries
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and (
        (sm.store_id = hq_menu_template_deliveries.source_store_id and sm.role in ('owner', 'admin'))
        or (sm.store_id = any(hq_menu_template_deliveries.target_store_ids) and sm.role = 'owner')
      )
  )
);

drop policy if exists hq_menu_template_deliveries_insert_owner
  on public.hq_menu_template_deliveries;
create policy hq_menu_template_deliveries_insert_owner
on public.hq_menu_template_deliveries
for insert to authenticated
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = hq_menu_template_deliveries.source_store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role = 'owner'
  )
);

drop policy if exists hq_menu_template_deliveries_update_owner
  on public.hq_menu_template_deliveries;
create policy hq_menu_template_deliveries_update_owner
on public.hq_menu_template_deliveries
for update to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and (
        (sm.store_id = hq_menu_template_deliveries.source_store_id and sm.role = 'owner')
        or (sm.store_id = any(hq_menu_template_deliveries.target_store_ids) and sm.role = 'owner')
      )
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
      and (
        (sm.store_id = hq_menu_template_deliveries.source_store_id and sm.role = 'owner')
        or (sm.store_id = any(hq_menu_template_deliveries.target_store_ids) and sm.role = 'owner')
      )
  )
);

drop policy if exists hq_menu_template_delivery_approvals_select_policy
  on public.hq_menu_template_delivery_approvals;
create policy hq_menu_template_delivery_approvals_select_policy
on public.hq_menu_template_delivery_approvals
for select to authenticated
using (
  exists (
    select 1
    from public.hq_menu_template_deliveries d
    join public.store_memberships sm
      on sm.user_id = auth.uid()
     and sm.is_active = true
    where d.id = hq_menu_template_delivery_approvals.delivery_id
      and (
        (sm.store_id = d.source_store_id and sm.role in ('owner', 'admin'))
        or (sm.store_id = any(d.target_store_ids) and sm.role = 'owner')
      )
  )
);

drop policy if exists hq_menu_template_delivery_approvals_insert_owner
  on public.hq_menu_template_delivery_approvals;
create policy hq_menu_template_delivery_approvals_insert_owner
on public.hq_menu_template_delivery_approvals
for insert to authenticated
with check (
  exists (
    select 1
    from public.hq_menu_template_deliveries d
    join public.store_memberships sm
      on sm.store_id = hq_menu_template_delivery_approvals.store_id
     and sm.user_id = auth.uid()
     and sm.is_active = true
    where d.id = hq_menu_template_delivery_approvals.delivery_id
      and sm.role = 'owner'
      and sm.store_id = any(d.target_store_ids)
  )
);

drop policy if exists hq_menu_template_delivery_approvals_update_owner
  on public.hq_menu_template_delivery_approvals;
create policy hq_menu_template_delivery_approvals_update_owner
on public.hq_menu_template_delivery_approvals
for update to authenticated
using (
  exists (
    select 1
    from public.hq_menu_template_deliveries d
    join public.store_memberships sm
      on sm.store_id = hq_menu_template_delivery_approvals.store_id
     and sm.user_id = auth.uid()
     and sm.is_active = true
    where d.id = hq_menu_template_delivery_approvals.delivery_id
      and sm.role = 'owner'
      and sm.store_id = any(d.target_store_ids)
  )
)
with check (
  exists (
    select 1
    from public.hq_menu_template_deliveries d
    join public.store_memberships sm
      on sm.store_id = hq_menu_template_delivery_approvals.store_id
     and sm.user_id = auth.uid()
     and sm.is_active = true
    where d.id = hq_menu_template_delivery_approvals.delivery_id
      and sm.role = 'owner'
      and sm.store_id = any(d.target_store_ids)
  )
);

commit;
