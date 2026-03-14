-- Inventory master setup audit (store rollout readiness)
-- Purpose:
-- - Find items missing reorder setup values before multi-store rollout.
-- - Run in Supabase SQL editor and set store_id in tmp_audit_params.

begin;

drop table if exists tmp_audit_params;
create temporary table tmp_audit_params (
  store_id uuid not null
) on commit drop;

insert into tmp_audit_params(store_id)
values ('00000000-0000-0000-0000-000000000000'::uuid);

-- =========================================================
-- 1) Summary counts
-- =========================================================
with target_items as (
  select
    i.store_id,
    i.id as item_id,
    i.name as item_name,
    coalesce(i.reorder_point, 0) as reorder_point,
    coalesce(i.optimal_stock, 0) as optimal_stock,
    coalesce(i.lead_time_days, 0) as lead_time_days,
    nullif(trim(coalesce(i.preferred_supplier_name, '')), '') as preferred_supplier_name,
    i.is_active
  from public.inventory_items i
  join tmp_audit_params p
    on p.store_id = i.store_id
)
select
  count(*) filter (where is_active = true) as active_item_count,
  count(*) filter (where is_active = true and reorder_point <= 0) as reorder_point_unset_count,
  count(*) filter (where is_active = true and optimal_stock <= 0) as optimal_stock_unset_count,
  count(*) filter (where is_active = true and lead_time_days <= 0) as lead_time_days_unset_count,
  count(*) filter (where is_active = true and preferred_supplier_name is null) as preferred_supplier_unset_count
from target_items;

-- =========================================================
-- 2) Detail rows for corrective action
-- =========================================================
with target_items as (
  select
    i.store_id,
    i.id as item_id,
    i.name as item_name,
    i.category,
    i.unit,
    coalesce(i.reorder_point, 0) as reorder_point,
    coalesce(i.optimal_stock, 0) as optimal_stock,
    coalesce(i.lead_time_days, 0) as lead_time_days,
    nullif(trim(coalesce(i.preferred_supplier_name, '')), '') as preferred_supplier_name,
    i.is_active
  from public.inventory_items i
  join tmp_audit_params p
    on p.store_id = i.store_id
)
select
  store_id,
  item_id,
  item_name,
  category,
  unit,
  reorder_point,
  optimal_stock,
  lead_time_days,
  preferred_supplier_name,
  (reorder_point <= 0) as missing_reorder_point,
  (optimal_stock <= 0) as missing_optimal_stock,
  (lead_time_days <= 0) as missing_lead_time_days,
  (preferred_supplier_name is null) as missing_preferred_supplier_name,
  concat_ws(
    ',',
    case when reorder_point <= 0 then 'reorder_point' end,
    case when optimal_stock <= 0 then 'optimal_stock' end,
    case when lead_time_days <= 0 then 'lead_time_days' end,
    case when preferred_supplier_name is null then 'preferred_supplier_name' end
  ) as missing_fields,
  case
    when reorder_point <= 0 then 'reorder_point'
    when optimal_stock <= 0 then 'optimal_stock'
    when lead_time_days <= 0 then 'lead_time_days'
    when preferred_supplier_name is null then 'preferred_supplier_name'
    else 'ok'
  end as first_missing_field
from target_items
where is_active = true
  and (
    reorder_point <= 0
    or optimal_stock <= 0
    or lead_time_days <= 0
    or preferred_supplier_name is null
  )
order by item_name asc
limit 500;

commit;
