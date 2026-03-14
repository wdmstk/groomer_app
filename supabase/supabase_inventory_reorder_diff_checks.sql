-- Diff checks for inventory reorder suggestion migration.
-- Set store_id only once in tmp_diff_params.

begin;

drop table if exists tmp_diff_params;
create temporary table tmp_diff_params (
  store_id uuid not null
) on commit drop;

insert into tmp_diff_params(store_id)
values ('00000000-0000-0000-0000-000000000000'::uuid);

-- =========================================================
-- 1) inventory_stock_summary_v: diff counts
-- =========================================================
with raw_stock_summary as (
  with movement_summary as (
    select
      m.store_id,
      m.item_id,
      sum(coalesce(m.quantity_delta, 0)) as current_stock,
      max(m.happened_at) filter (where m.movement_type = 'inbound') as last_inbound_at,
      max(m.happened_at) filter (where m.movement_type = 'outbound') as last_outbound_at,
      count(*) filter (
        where m.expires_on is not null
          and m.expires_on between timezone('Asia/Tokyo', now())::date
            and (timezone('Asia/Tokyo', now())::date + 14)
          and coalesce(m.quantity_delta, 0) > 0
      ) as expiring_14d_lot_count
    from public.inventory_movements m
    join tmp_diff_params p
      on p.store_id = m.store_id
    group by m.store_id, m.item_id
  ),
  latest_inbound_cost as (
    select distinct on (m.store_id, m.item_id)
      m.store_id,
      m.item_id,
      coalesce(m.unit_cost, 0)::numeric as last_inbound_unit_cost
    from public.inventory_movements m
    join tmp_diff_params p
      on p.store_id = m.store_id
    where m.movement_type = 'inbound'
      and m.unit_cost is not null
    order by m.store_id, m.item_id, m.happened_at desc, m.created_at desc
  )
  select
    i.store_id,
    i.id as item_id,
    coalesce(ms.current_stock, 0)::numeric as current_stock,
    coalesce(i.reorder_point, 0)::numeric as reorder_point,
    coalesce(i.optimal_stock, 0)::numeric as optimal_stock,
    coalesce(i.minimum_order_quantity, 0)::numeric as minimum_order_quantity,
    coalesce(i.order_lot_size, 0)::numeric as order_lot_size,
    coalesce(i.lead_time_days, 0) as lead_time_days,
    coalesce(lic.last_inbound_unit_cost, 0)::numeric as last_inbound_unit_cost,
    ms.last_inbound_at,
    ms.last_outbound_at,
    coalesce(ms.expiring_14d_lot_count, 0) as expiring_14d_lot_count
  from public.inventory_items i
  left join movement_summary ms
    on ms.store_id = i.store_id
   and ms.item_id = i.id
  left join latest_inbound_cost lic
    on lic.store_id = i.store_id
   and lic.item_id = i.id
  join tmp_diff_params p
    on p.store_id = i.store_id
)
select
  'inventory_stock_summary_v' as check_name,
  count(*) filter (where coalesce(v.current_stock, 0) <> r.current_stock) as current_stock_diff_count,
  count(*) filter (where coalesce(v.last_inbound_unit_cost, 0) <> r.last_inbound_unit_cost) as inbound_cost_diff_count,
  count(*) filter (where coalesce(v.expiring_14d_lot_count, 0) <> r.expiring_14d_lot_count) as expiring_diff_count,
  case
    when count(*) filter (where coalesce(v.current_stock, 0) <> r.current_stock) = 0
     and count(*) filter (where coalesce(v.last_inbound_unit_cost, 0) <> r.last_inbound_unit_cost) = 0
     and count(*) filter (where coalesce(v.expiring_14d_lot_count, 0) <> r.expiring_14d_lot_count) = 0
    then true else false
  end as stock_summary_is_clean
from raw_stock_summary r
left join public.inventory_stock_summary_v v
  on v.store_id = r.store_id
 and v.item_id = r.item_id;

-- =========================================================
-- 2) inventory_stock_summary_v: detail rows (top 100)
-- =========================================================
with raw_stock_summary as (
  with movement_summary as (
    select
      m.store_id,
      m.item_id,
      sum(coalesce(m.quantity_delta, 0)) as current_stock,
      max(m.happened_at) filter (where m.movement_type = 'inbound') as last_inbound_at,
      max(m.happened_at) filter (where m.movement_type = 'outbound') as last_outbound_at,
      count(*) filter (
        where m.expires_on is not null
          and m.expires_on between timezone('Asia/Tokyo', now())::date
            and (timezone('Asia/Tokyo', now())::date + 14)
          and coalesce(m.quantity_delta, 0) > 0
      ) as expiring_14d_lot_count
    from public.inventory_movements m
    join tmp_diff_params p
      on p.store_id = m.store_id
    group by m.store_id, m.item_id
  ),
  latest_inbound_cost as (
    select distinct on (m.store_id, m.item_id)
      m.store_id,
      m.item_id,
      coalesce(m.unit_cost, 0)::numeric as last_inbound_unit_cost
    from public.inventory_movements m
    join tmp_diff_params p
      on p.store_id = m.store_id
    where m.movement_type = 'inbound'
      and m.unit_cost is not null
    order by m.store_id, m.item_id, m.happened_at desc, m.created_at desc
  )
  select
    i.store_id,
    i.id as item_id,
    i.name as item_name,
    coalesce(ms.current_stock, 0)::numeric as current_stock,
    coalesce(lic.last_inbound_unit_cost, 0)::numeric as last_inbound_unit_cost,
    coalesce(ms.expiring_14d_lot_count, 0) as expiring_14d_lot_count
  from public.inventory_items i
  left join movement_summary ms
    on ms.store_id = i.store_id
   and ms.item_id = i.id
  left join latest_inbound_cost lic
    on lic.store_id = i.store_id
   and lic.item_id = i.id
  join tmp_diff_params p
    on p.store_id = i.store_id
)
select
  coalesce(v.store_id, r.store_id) as store_id,
  coalesce(v.item_id, r.item_id) as item_id,
  r.item_name,
  r.current_stock as raw_current_stock,
  coalesce(v.current_stock, 0) as view_current_stock,
  r.last_inbound_unit_cost as raw_last_inbound_unit_cost,
  coalesce(v.last_inbound_unit_cost, 0) as view_last_inbound_unit_cost,
  r.expiring_14d_lot_count as raw_expiring_14d_lot_count,
  coalesce(v.expiring_14d_lot_count, 0) as view_expiring_14d_lot_count
from raw_stock_summary r
full outer join public.inventory_stock_summary_v v
  on v.store_id = r.store_id
 and v.item_id = r.item_id
join tmp_diff_params p
  on p.store_id = coalesce(v.store_id, r.store_id)
where coalesce(v.current_stock, 0) <> coalesce(r.current_stock, 0)
   or coalesce(v.last_inbound_unit_cost, 0) <> coalesce(r.last_inbound_unit_cost, 0)
   or coalesce(v.expiring_14d_lot_count, 0) <> coalesce(r.expiring_14d_lot_count, 0)
order by coalesce(v.item_id, r.item_id)
limit 100;

-- =========================================================
-- 3) inventory_reorder_suggestion_v: diff counts
-- =========================================================
with raw_stock_summary as (
  with movement_summary as (
    select
      m.store_id,
      m.item_id,
      sum(coalesce(m.quantity_delta, 0)) as current_stock
    from public.inventory_movements m
    join tmp_diff_params p
      on p.store_id = m.store_id
    group by m.store_id, m.item_id
  )
  select
    i.store_id,
    i.id as item_id,
    coalesce(ms.current_stock, 0)::numeric as current_stock,
    coalesce(i.reorder_point, 0)::numeric as reorder_point,
    coalesce(i.optimal_stock, 0)::numeric as optimal_stock,
    coalesce(i.minimum_order_quantity, 0)::numeric as minimum_order_quantity,
    coalesce(i.order_lot_size, 0)::numeric as order_lot_size,
    coalesce(i.lead_time_days, 0) as lead_time_days
  from public.inventory_items i
  left join movement_summary ms
    on ms.store_id = i.store_id
   and ms.item_id = i.id
  join tmp_diff_params p
    on p.store_id = i.store_id
),
raw_reorder_suggestion as (
  with base as (
    select
      rs.*,
      (rs.current_stock <= rs.reorder_point) as is_below_reorder_point,
      greatest(0, rs.optimal_stock - rs.current_stock) as raw_recommended_quantity
    from raw_stock_summary rs
  ),
  minimum_applied as (
    select
      b.*,
      case
        when b.raw_recommended_quantity <= 0 then 0::numeric
        when b.minimum_order_quantity > 0
          then greatest(b.raw_recommended_quantity, b.minimum_order_quantity)
        else b.raw_recommended_quantity
      end as minimum_applied_quantity
    from base b
  )
  select
    ma.store_id,
    ma.item_id,
    ma.is_below_reorder_point,
    ma.raw_recommended_quantity,
    case
      when ma.minimum_applied_quantity <= 0 then 0::numeric
      when ma.order_lot_size > 0
        then ceil(ma.minimum_applied_quantity / ma.order_lot_size) * ma.order_lot_size
      else ma.minimum_applied_quantity
    end as recommended_quantity
  from minimum_applied ma
  where ma.is_below_reorder_point = true
)
select
  'inventory_reorder_suggestion_v' as check_name,
  count(*) filter (where coalesce(v.raw_recommended_quantity, 0) <> r.raw_recommended_quantity) as raw_quantity_diff_count,
  count(*) filter (where coalesce(v.recommended_quantity, 0) <> r.recommended_quantity) as recommended_quantity_diff_count,
  case
    when count(*) filter (where coalesce(v.raw_recommended_quantity, 0) <> r.raw_recommended_quantity) = 0
     and count(*) filter (where coalesce(v.recommended_quantity, 0) <> r.recommended_quantity) = 0
    then true else false
  end as reorder_suggestion_is_clean
from raw_reorder_suggestion r
left join public.inventory_reorder_suggestion_v v
  on v.store_id = r.store_id
 and v.item_id = r.item_id;

-- =========================================================
-- 4) inventory_reorder_suggestion_v: detail rows (top 100)
-- =========================================================
with raw_stock_summary as (
  with movement_summary as (
    select
      m.store_id,
      m.item_id,
      sum(coalesce(m.quantity_delta, 0)) as current_stock
    from public.inventory_movements m
    join tmp_diff_params p
      on p.store_id = m.store_id
    group by m.store_id, m.item_id
  )
  select
    i.store_id,
    i.id as item_id,
    i.name as item_name,
    coalesce(ms.current_stock, 0)::numeric as current_stock,
    coalesce(i.reorder_point, 0)::numeric as reorder_point,
    coalesce(i.optimal_stock, 0)::numeric as optimal_stock,
    coalesce(i.minimum_order_quantity, 0)::numeric as minimum_order_quantity,
    coalesce(i.order_lot_size, 0)::numeric as order_lot_size,
    coalesce(i.lead_time_days, 0) as lead_time_days
  from public.inventory_items i
  left join movement_summary ms
    on ms.store_id = i.store_id
   and ms.item_id = i.id
  join tmp_diff_params p
    on p.store_id = i.store_id
),
raw_reorder_suggestion as (
  with base as (
    select
      rs.*,
      (rs.current_stock <= rs.reorder_point) as is_below_reorder_point,
      greatest(0, rs.optimal_stock - rs.current_stock) as raw_recommended_quantity
    from raw_stock_summary rs
  ),
  minimum_applied as (
    select
      b.*,
      case
        when b.raw_recommended_quantity <= 0 then 0::numeric
        when b.minimum_order_quantity > 0
          then greatest(b.raw_recommended_quantity, b.minimum_order_quantity)
        else b.raw_recommended_quantity
      end as minimum_applied_quantity
    from base b
  )
  select
    ma.store_id,
    ma.item_id,
    ma.item_name,
    ma.current_stock,
    ma.reorder_point,
    ma.optimal_stock,
    ma.minimum_order_quantity,
    ma.order_lot_size,
    ma.raw_recommended_quantity,
    case
      when ma.minimum_applied_quantity <= 0 then 0::numeric
      when ma.order_lot_size > 0
        then ceil(ma.minimum_applied_quantity / ma.order_lot_size) * ma.order_lot_size
      else ma.minimum_applied_quantity
    end as recommended_quantity
  from minimum_applied ma
  where ma.is_below_reorder_point = true
)
select
  coalesce(v.store_id, r.store_id) as store_id,
  coalesce(v.item_id, r.item_id) as item_id,
  r.item_name,
  r.current_stock,
  r.reorder_point,
  r.optimal_stock,
  r.minimum_order_quantity,
  r.order_lot_size,
  r.raw_recommended_quantity as raw_raw_recommended_quantity,
  coalesce(v.raw_recommended_quantity, 0) as view_raw_recommended_quantity,
  r.recommended_quantity as raw_recommended_quantity,
  coalesce(v.recommended_quantity, 0) as view_recommended_quantity
from raw_reorder_suggestion r
full outer join public.inventory_reorder_suggestion_v v
  on v.store_id = r.store_id
 and v.item_id = r.item_id
join tmp_diff_params p
  on p.store_id = coalesce(v.store_id, r.store_id)
where coalesce(v.raw_recommended_quantity, 0) <> coalesce(r.raw_recommended_quantity, 0)
   or coalesce(v.recommended_quantity, 0) <> coalesce(r.recommended_quantity, 0)
order by coalesce(v.item_id, r.item_id)
limit 100;

-- =========================================================
-- 5) Draft post-checks after generation
-- =========================================================
-- Run after creating drafts from the reorder suggestions UI.
-- Notes:
-- - expected_on mismatch means draft lead-time aggregation may be off.
-- - unit_cost mismatch may be valid if the operator manually overrode unit cost.

with target_orders as (
  select
    po.id as purchase_order_id,
    po.store_id,
    po.order_no,
    po.supplier_name,
    po.expected_on
  from public.inventory_purchase_orders po
  join tmp_diff_params p
    on p.store_id = po.store_id
  where po.status = 'draft'
    and po.notes = '発注提案から自動生成'
),
order_lead as (
  select
    to2.purchase_order_id,
    max(coalesce(ii.lead_time_days, 0)) as max_lead_time_days
  from target_orders to2
  join public.inventory_purchase_order_items poi
    on poi.store_id = to2.store_id
   and poi.purchase_order_id = to2.purchase_order_id
  left join public.inventory_items ii
    on ii.store_id = poi.store_id
   and ii.id = poi.item_id
  group by to2.purchase_order_id
),
expected_on_check as (
  select
    to2.purchase_order_id,
    to2.order_no,
    to2.supplier_name,
    to2.expected_on as actual_expected_on,
    case
      when coalesce(ol.max_lead_time_days, 0) > 0
        then (timezone('Asia/Tokyo', now())::date + ol.max_lead_time_days)
      else null::date
    end as expected_expected_on
  from target_orders to2
  left join order_lead ol
    on ol.purchase_order_id = to2.purchase_order_id
)
select
  'draft_expected_on_check' as check_name,
  count(*) as draft_order_count,
  count(*) filter (
    where coalesce(actual_expected_on, '1900-01-01'::date) <> coalesce(expected_expected_on, '1900-01-01'::date)
  ) as expected_on_mismatch_count
from expected_on_check;

with target_lines as (
  select
    poi.id as line_id,
    poi.store_id,
    poi.purchase_order_id,
    poi.item_id,
    poi.item_name,
    poi.unit_cost
  from public.inventory_purchase_order_items poi
  join public.inventory_purchase_orders po
    on po.store_id = poi.store_id
   and po.id = poi.purchase_order_id
  join tmp_diff_params p
    on p.store_id = poi.store_id
  where po.status = 'draft'
    and po.notes = '発注提案から自動生成'
),
latest_inbound_cost as (
  select distinct on (m.store_id, m.item_id)
    m.store_id,
    m.item_id,
    coalesce(m.unit_cost, 0)::numeric as last_inbound_unit_cost
  from public.inventory_movements m
  join tmp_diff_params p
    on p.store_id = m.store_id
  where m.movement_type = 'inbound'
    and m.unit_cost is not null
  order by m.store_id, m.item_id, m.happened_at desc, m.created_at desc
)
select
  'draft_unit_cost_check' as check_name,
  count(*) as draft_line_count,
  count(*) filter (
    where tl.item_id is not null
      and coalesce(tl.unit_cost, 0) <> coalesce(lic.last_inbound_unit_cost, 0)
  ) as unit_cost_mismatch_count
from target_lines tl
left join latest_inbound_cost lic
  on lic.store_id = tl.store_id
 and lic.item_id = tl.item_id;

-- Detail rows for unit_cost mismatches (top 100)
with target_lines as (
  select
    poi.id as line_id,
    poi.store_id,
    poi.purchase_order_id,
    poi.item_id,
    poi.item_name,
    poi.unit_cost
  from public.inventory_purchase_order_items poi
  join public.inventory_purchase_orders po
    on po.store_id = poi.store_id
   and po.id = poi.purchase_order_id
  join tmp_diff_params p
    on p.store_id = poi.store_id
  where po.status = 'draft'
    and po.notes = '発注提案から自動生成'
),
latest_inbound_cost as (
  select distinct on (m.store_id, m.item_id)
    m.store_id,
    m.item_id,
    coalesce(m.unit_cost, 0)::numeric as last_inbound_unit_cost
  from public.inventory_movements m
  join tmp_diff_params p
    on p.store_id = m.store_id
  where m.movement_type = 'inbound'
    and m.unit_cost is not null
  order by m.store_id, m.item_id, m.happened_at desc, m.created_at desc
)
select
  tl.store_id,
  tl.purchase_order_id,
  tl.line_id,
  tl.item_id,
  tl.item_name,
  tl.unit_cost as draft_unit_cost,
  lic.last_inbound_unit_cost
from target_lines tl
left join latest_inbound_cost lic
  on lic.store_id = tl.store_id
 and lic.item_id = tl.item_id
where tl.item_id is not null
  and coalesce(tl.unit_cost, 0) <> coalesce(lic.last_inbound_unit_cost, 0)
order by tl.purchase_order_id, tl.line_id
limit 100;

commit;
