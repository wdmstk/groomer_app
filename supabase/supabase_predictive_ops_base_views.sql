begin;

create or replace view public.predictive_customer_daily_features
with (security_invoker = true) as
select
  a.store_id,
  a.customer_id,
  ((a.start_time at time zone 'Asia/Tokyo')::date) as metric_date_jst,
  count(*) as appointments_count,
  count(*) filter (where a.status in ('完了', '来店済')) as completed_count,
  count(*) filter (where a.status in ('キャンセル', '無断キャンセル')) as canceled_count,
  count(*) filter (where a.status = '無断キャンセル') as no_show_count,
  max(a.start_time) as latest_start_time
from public.appointments a
where a.customer_id is not null
group by
  a.store_id,
  a.customer_id,
  ((a.start_time at time zone 'Asia/Tokyo')::date);

create or replace view public.predictive_store_daily_features
with (security_invoker = true) as
with appointment_daily as (
  select
    a.store_id,
    ((a.start_time at time zone 'Asia/Tokyo')::date) as metric_date_jst,
    count(*) as appointments_count,
    count(*) filter (where a.status in ('完了', '来店済')) as completed_count,
    count(*) filter (where a.status in ('キャンセル', '無断キャンセル')) as canceled_count,
    count(*) filter (where a.status = '無断キャンセル') as no_show_count
  from public.appointments a
  group by
    a.store_id,
    ((a.start_time at time zone 'Asia/Tokyo')::date)
),
revert_daily as (
  select
    l.store_id,
    ((l.created_at at time zone 'Asia/Tokyo')::date) as metric_date_jst,
    count(*) as status_revert_count
  from public.audit_logs l
  where l.entity_type = 'appointment'
    and l.action = 'status_reverted'
  group by
    l.store_id,
    ((l.created_at at time zone 'Asia/Tokyo')::date)
)
select
  a.store_id,
  a.metric_date_jst,
  a.appointments_count,
  a.completed_count,
  a.canceled_count,
  a.no_show_count,
  coalesce(r.status_revert_count, 0) as status_revert_count
from appointment_daily a
left join revert_daily r
  on r.store_id = a.store_id
 and r.metric_date_jst = a.metric_date_jst;

commit;
