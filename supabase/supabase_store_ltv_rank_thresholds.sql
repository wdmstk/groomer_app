begin;

alter table if exists public.stores
  add column if not exists ltv_gold_annual_sales_threshold integer not null default 120000,
  add column if not exists ltv_silver_annual_sales_threshold integer not null default 60000,
  add column if not exists ltv_bronze_annual_sales_threshold integer not null default 30000,
  add column if not exists ltv_gold_visit_count_threshold integer not null default 12,
  add column if not exists ltv_silver_visit_count_threshold integer not null default 6,
  add column if not exists ltv_bronze_visit_count_threshold integer not null default 3;

alter table if exists public.stores
  drop constraint if exists stores_ltv_annual_thresholds_order_check;
alter table if exists public.stores
  add constraint stores_ltv_annual_thresholds_order_check
  check (
    ltv_gold_annual_sales_threshold >= ltv_silver_annual_sales_threshold
    and ltv_silver_annual_sales_threshold >= ltv_bronze_annual_sales_threshold
    and ltv_bronze_annual_sales_threshold >= 0
  );

alter table if exists public.stores
  drop constraint if exists stores_ltv_visit_thresholds_order_check;
alter table if exists public.stores
  add constraint stores_ltv_visit_thresholds_order_check
  check (
    ltv_gold_visit_count_threshold >= ltv_silver_visit_count_threshold
    and ltv_silver_visit_count_threshold >= ltv_bronze_visit_count_threshold
    and ltv_bronze_visit_count_threshold >= 0
  );

comment on column public.stores.ltv_gold_annual_sales_threshold is
  'LTVランク: ゴールド判定の年間売上しきい値（円）。';
comment on column public.stores.ltv_silver_annual_sales_threshold is
  'LTVランク: シルバー判定の年間売上しきい値（円）。';
comment on column public.stores.ltv_bronze_annual_sales_threshold is
  'LTVランク: ブロンズ判定の年間売上しきい値（円）。';
comment on column public.stores.ltv_gold_visit_count_threshold is
  'LTVランク: ゴールド判定の来店回数しきい値（回）。';
comment on column public.stores.ltv_silver_visit_count_threshold is
  'LTVランク: シルバー判定の来店回数しきい値（回）。';
comment on column public.stores.ltv_bronze_visit_count_threshold is
  'LTVランク: ブロンズ判定の来店回数しきい値（回）。';

commit;
