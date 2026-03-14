begin;

create or replace view public.hq_store_daily_metrics_v1
with (security_invoker = true) as
with appointment_daily as (
  select
    a.store_id,
    timezone('Asia/Tokyo', a.start_time)::date as metric_date_jst,
    count(*) as appointments_count,
    count(*) filter (where a.status in ('完了', '来店済')) as completed_count,
    count(*) filter (where a.status in ('キャンセル', '無断キャンセル')) as canceled_count
  from public.appointments a
  where a.start_time is not null
  group by a.store_id, timezone('Asia/Tokyo', a.start_time)::date
),
payment_daily as (
  select
    p.store_id,
    timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date as metric_date_jst,
    sum(case when p.status = '支払済' then coalesce(p.total_amount, 0) else 0 end) as sales_amount
  from public.payments p
  group by p.store_id, timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date
),
keys as (
  select store_id, metric_date_jst from appointment_daily
  union
  select store_id, metric_date_jst from payment_daily
)
select
  k.store_id,
  k.metric_date_jst,
  coalesce(a.appointments_count, 0) as appointments_count,
  coalesce(a.completed_count, 0) as completed_count,
  coalesce(a.canceled_count, 0) as canceled_count,
  coalesce(p.sales_amount, 0)::numeric as sales_amount
from keys k
left join appointment_daily a
  on a.store_id = k.store_id
 and a.metric_date_jst = k.metric_date_jst
left join payment_daily p
  on p.store_id = k.store_id
 and p.metric_date_jst = k.metric_date_jst;

comment on view public.hq_store_daily_metrics_v1 is
  '本部向けの店舗日次KPI（予約件数、完了件数、キャンセル件数、売上）。JST基準。';

commit;
