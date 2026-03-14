begin;

-- -------------------------------------------------------------------
-- Fix: SECURITY DEFINER view lint
-- -------------------------------------------------------------------
alter view if exists public.inventory_stock_summary_v set (security_invoker = true);
alter view if exists public.followup_daily_summary_v set (security_invoker = true);
alter view if exists public.predictive_store_daily_features set (security_invoker = true);
alter view if exists public.appointment_form_metric_daily_summary_v set (security_invoker = true);
alter view if exists public.payment_daily_summary_v set (security_invoker = true);
alter view if exists public.completed_appointment_revisit_source_v set (security_invoker = true);
alter view if exists public.appointment_staff_gap_kpi_daily_summary_v set (security_invoker = true);
alter view if exists public.appointment_daily_summary_v set (security_invoker = true);
alter view if exists public.predictive_customer_daily_features set (security_invoker = true);
alter view if exists public.no_show_customer_kpi_source_v set (security_invoker = true);
alter view if exists public.reoffer_daily_summary_v set (security_invoker = true);
alter view if exists public.completed_appointment_daily_summary_v set (security_invoker = true);
alter view if exists public.visit_daily_summary_v set (security_invoker = true);
alter view if exists public.inventory_reorder_suggestion_v set (security_invoker = true);
alter view if exists public.appointment_duration_kpi_daily_summary_v set (security_invoker = true);

-- -------------------------------------------------------------------
-- Fix: RLS disabled lint
-- -------------------------------------------------------------------
alter table if exists public.hq_menu_template_deliveries enable row level security;
alter table if exists public.hq_menu_template_delivery_approvals enable row level security;
alter table if exists public.store_public_reserve_blocked_dates enable row level security;

drop policy if exists store_public_reserve_blocked_dates_select_store
  on public.store_public_reserve_blocked_dates;
create policy store_public_reserve_blocked_dates_select_store
on public.store_public_reserve_blocked_dates
for select to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_public_reserve_blocked_dates.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
  )
);

drop policy if exists store_public_reserve_blocked_dates_modify_owner_admin
  on public.store_public_reserve_blocked_dates;
create policy store_public_reserve_blocked_dates_modify_owner_admin
on public.store_public_reserve_blocked_dates
for all to authenticated
using (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_public_reserve_blocked_dates.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = store_public_reserve_blocked_dates.store_id
      and sm.user_id = auth.uid()
      and sm.is_active = true
      and sm.role in ('owner', 'admin')
  )
);

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
