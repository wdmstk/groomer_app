begin;

create or replace view public.customer_ltv_summary_v
with (security_invoker = true) as
with paid_payments as (
  select
    p.store_id,
    p.customer_id,
    p.visit_id,
    p.total_amount,
    coalesce(p.paid_at, p.created_at) as paid_at
  from public.payments p
  where p.status = '支払済'
    and p.customer_id is not null
),
visit_menu_counts as (
  select
    vm.store_id,
    vm.visit_id,
    count(*) as menu_count
  from public.visit_menus vm
  group by vm.store_id, vm.visit_id
),
visit_metrics as (
  select
    pp.store_id,
    pp.customer_id,
    count(*) as payment_count,
    count(distinct pp.visit_id) filter (where pp.visit_id is not null) as visit_count,
    sum(coalesce(pp.total_amount, 0)) as lifetime_sales,
    sum(coalesce(pp.total_amount, 0)) filter (
      where pp.paid_at >= (timezone('Asia/Tokyo', now())::date - interval '1 year')
    ) as annual_sales,
    avg(coalesce(pp.total_amount, 0)) as average_spend,
    max(pp.paid_at) as last_paid_at,
    count(*) filter (where coalesce(vmc.menu_count, 0) > 1) as option_visit_count
  from paid_payments pp
  left join visit_menu_counts vmc
    on vmc.store_id = pp.store_id
   and vmc.visit_id = pp.visit_id
  group by pp.store_id, pp.customer_id
)
select
  vm.store_id,
  vm.customer_id,
  coalesce(vm.annual_sales, 0)::numeric as annual_sales,
  coalesce(vm.visit_count, 0)::bigint as visit_count,
  round(coalesce(vm.average_spend, 0)::numeric, 0) as average_spend,
  case
    when coalesce(vm.visit_count, 0) = 0 then 0::numeric
    else round((vm.option_visit_count::numeric / vm.visit_count::numeric) * 100, 1)
  end as option_usage_rate,
  case
    when case
      when coalesce(s.ltv_gold_annual_sales_threshold, 120000) > 0
        and coalesce(s.ltv_gold_visit_count_threshold, 12) > 0 then
        coalesce(vm.annual_sales, 0) >= coalesce(s.ltv_gold_annual_sales_threshold, 120000)
        or coalesce(vm.visit_count, 0) >= coalesce(s.ltv_gold_visit_count_threshold, 12)
      when coalesce(s.ltv_gold_annual_sales_threshold, 120000) > 0 then
        coalesce(vm.annual_sales, 0) >= coalesce(s.ltv_gold_annual_sales_threshold, 120000)
      when coalesce(s.ltv_gold_visit_count_threshold, 12) > 0 then
        coalesce(vm.visit_count, 0) >= coalesce(s.ltv_gold_visit_count_threshold, 12)
      else false
    end then 'ゴールド'
    when case
      when coalesce(s.ltv_silver_annual_sales_threshold, 60000) > 0
        and coalesce(s.ltv_silver_visit_count_threshold, 6) > 0 then
        coalesce(vm.annual_sales, 0) >= coalesce(s.ltv_silver_annual_sales_threshold, 60000)
        or coalesce(vm.visit_count, 0) >= coalesce(s.ltv_silver_visit_count_threshold, 6)
      when coalesce(s.ltv_silver_annual_sales_threshold, 60000) > 0 then
        coalesce(vm.annual_sales, 0) >= coalesce(s.ltv_silver_annual_sales_threshold, 60000)
      when coalesce(s.ltv_silver_visit_count_threshold, 6) > 0 then
        coalesce(vm.visit_count, 0) >= coalesce(s.ltv_silver_visit_count_threshold, 6)
      else false
    end then 'シルバー'
    when case
      when coalesce(s.ltv_bronze_annual_sales_threshold, 30000) > 0
        and coalesce(s.ltv_bronze_visit_count_threshold, 3) > 0 then
        coalesce(vm.annual_sales, 0) >= coalesce(s.ltv_bronze_annual_sales_threshold, 30000)
        or coalesce(vm.visit_count, 0) >= coalesce(s.ltv_bronze_visit_count_threshold, 3)
      when coalesce(s.ltv_bronze_annual_sales_threshold, 30000) > 0 then
        coalesce(vm.annual_sales, 0) >= coalesce(s.ltv_bronze_annual_sales_threshold, 30000)
      when coalesce(s.ltv_bronze_visit_count_threshold, 3) > 0 then
        coalesce(vm.visit_count, 0) >= coalesce(s.ltv_bronze_visit_count_threshold, 3)
      else false
    end then 'ブロンズ'
    else 'スタンダード'
  end as ltv_rank,
  vm.last_paid_at
from visit_metrics vm
left join public.stores s
  on s.id = vm.store_id;

comment on view public.customer_ltv_summary_v is
  '顧客別の年間売上・来店回数・平均単価・オプション利用率・LTVランクを返す動的集計View。';

commit;
