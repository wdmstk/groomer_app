begin;

alter table if exists public.stores
  drop constraint if exists stores_ltv_rank_zero_switch_values_check;

alter table if exists public.stores
  drop column if exists ltv_sales_only_visit_count,
  drop column if exists ltv_visits_only_annual_sales;

commit;
