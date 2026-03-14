begin;

-- =========================================================
-- Groomer App: Inventory reorder suggestion views
-- =========================================================
-- Purpose:
-- - Provide SQL-backed current stock and reorder suggestion summaries.
-- - Keep the first iteration simple: replenish up to optimal_stock
--   once current_stock drops to reorder_point or below.
-- =========================================================

drop view if exists public.inventory_reorder_suggestion_v;
drop view if exists public.inventory_stock_summary_v;

create or replace view public.inventory_stock_summary_v
with (security_invoker = true) as
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
  group by m.store_id, m.item_id
),
latest_inbound_cost as (
  select distinct on (m.store_id, m.item_id)
    m.store_id,
    m.item_id,
    coalesce(m.unit_cost, 0)::numeric as last_inbound_unit_cost
  from public.inventory_movements m
  where m.movement_type = 'inbound'
    and m.unit_cost is not null
  order by m.store_id, m.item_id, m.happened_at desc, m.created_at desc
)
select
  i.store_id,
  i.id as item_id,
  i.name as item_name,
  i.category,
  i.unit,
  coalesce(i.preferred_supplier_name, i.supplier_name) as supplier_name,
  coalesce(ms.current_stock, 0)::numeric as current_stock,
  coalesce(i.reorder_point, 0)::numeric as reorder_point,
  coalesce(i.optimal_stock, 0)::numeric as optimal_stock,
  coalesce(i.minimum_order_quantity, 0)::numeric as minimum_order_quantity,
  coalesce(i.order_lot_size, 0)::numeric as order_lot_size,
  coalesce(i.lead_time_days, 0) as lead_time_days,
  coalesce(lic.last_inbound_unit_cost, 0)::numeric as last_inbound_unit_cost,
  ms.last_inbound_at,
  ms.last_outbound_at,
  coalesce(ms.expiring_14d_lot_count, 0) as expiring_14d_lot_count,
  i.is_active
from public.inventory_items i
left join movement_summary ms
  on ms.store_id = i.store_id
 and ms.item_id = i.id
left join latest_inbound_cost lic
  on lic.store_id = i.store_id
 and lic.item_id = i.id;

comment on view public.inventory_stock_summary_v is
  '商品ごとの現在庫、最終入出庫、期限切れ間近件数サマリ。発注提案と在庫確認のベース用。';


create or replace view public.inventory_reorder_suggestion_v
with (security_invoker = true) as
with suggestion_base as (
  select
    s.store_id,
    s.item_id,
    s.item_name,
    s.category,
    s.unit,
    s.supplier_name,
    s.current_stock,
    s.reorder_point,
    s.optimal_stock,
    s.minimum_order_quantity,
    s.order_lot_size,
    s.lead_time_days,
    s.last_inbound_unit_cost,
    s.last_inbound_at,
    s.last_outbound_at,
    s.expiring_14d_lot_count,
    (s.current_stock <= s.reorder_point) as is_below_reorder_point,
    greatest(0, s.optimal_stock - s.current_stock) as raw_recommended_quantity
  from public.inventory_stock_summary_v s
  where s.is_active = true
),
normalized as (
  select
    sb.*,
    case
      when sb.raw_recommended_quantity <= 0 then 0::numeric
      when sb.minimum_order_quantity > 0
        then greatest(sb.raw_recommended_quantity, sb.minimum_order_quantity)
      else sb.raw_recommended_quantity
    end as minimum_applied_quantity
  from suggestion_base sb
),
rounded as (
  select
    n.*,
    case
      when n.minimum_applied_quantity <= 0 then 0::numeric
      when n.order_lot_size > 0
        then ceil(n.minimum_applied_quantity / n.order_lot_size) * n.order_lot_size
      else n.minimum_applied_quantity
    end as recommended_quantity
  from normalized n
)
select
  r.store_id,
  r.item_id,
  r.item_name,
  r.category,
  r.unit,
  r.supplier_name,
  r.current_stock,
  r.reorder_point,
  r.optimal_stock,
  r.minimum_order_quantity,
  r.order_lot_size,
  r.lead_time_days,
  r.last_inbound_unit_cost,
  r.last_inbound_at,
  r.last_outbound_at,
  r.expiring_14d_lot_count,
  r.is_below_reorder_point,
  r.raw_recommended_quantity,
  r.recommended_quantity,
  row_number() over (
    partition by r.store_id
    order by
      case when r.current_stock <= 0 then 0 else 1 end,
      (r.reorder_point - r.current_stock) desc,
      r.lead_time_days desc,
      r.item_name asc
  ) as priority_rank
from rounded r
where r.is_below_reorder_point = true
  and r.recommended_quantity > 0;

comment on view public.inventory_reorder_suggestion_v is
  '商品ごとの発注提案サマリ。reorder_point 以下の商品に対して推奨発注数を返す。';

commit;
