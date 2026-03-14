begin;

-- =========================================================
-- Appointments KPI views
-- =========================================================
-- Purpose:
-- - Move the first appointments-kpi aggregations out of page-level TypeScript logic.
-- - Keep the first step narrow and diff-checkable.
-- - All dates are normalized to JST business dates.
-- =========================================================

drop view if exists public.no_show_customer_kpi_source_v;
drop view if exists public.completed_appointment_revisit_source_v;
drop view if exists public.completed_appointment_daily_summary_v;
drop view if exists public.appointment_staff_gap_kpi_daily_summary_v;
drop view if exists public.appointment_duration_kpi_daily_summary_v;
drop view if exists public.appointment_form_metric_daily_summary_v;

create or replace view public.appointment_form_metric_daily_summary_v
with (security_invoker = true) as
select
  m.store_id,
  timezone('Asia/Tokyo', m.created_at)::date as date_key,
  count(*) as submission_count,
  count(*) filter (where m.mode = 'new') as new_submission_count,
  count(*) filter (where m.mode = 'edit') as edit_submission_count,
  sum(coalesce(m.elapsed_ms, 0)) as total_elapsed_ms,
  sum(coalesce(m.click_count, 0)) as total_click_count,
  sum(coalesce(m.field_change_count, 0)) as total_field_change_count,
  round(avg(coalesce(m.elapsed_ms, 0))::numeric, 1) as avg_elapsed_ms,
  round(avg(coalesce(m.click_count, 0))::numeric, 1) as avg_click_count,
  round(avg(coalesce(m.field_change_count, 0))::numeric, 1) as avg_field_change_count,
  round(avg(coalesce(m.selected_menu_count, 0))::numeric, 1) as avg_selected_menu_count,
  round(avg(case when m.used_template_copy then 100 else 0 end)::numeric, 1) as template_copy_rate,
  sum(coalesce(m.elapsed_ms, 0)) filter (where m.mode = 'new') as new_total_elapsed_ms,
  sum(coalesce(m.click_count, 0)) filter (where m.mode = 'new') as new_total_click_count,
  sum(coalesce(m.field_change_count, 0)) filter (where m.mode = 'new') as new_total_field_change_count,
  round(avg(coalesce(m.elapsed_ms, 0)) filter (where m.mode = 'new')::numeric, 1) as new_avg_elapsed_ms,
  round(avg(coalesce(m.click_count, 0)) filter (where m.mode = 'new')::numeric, 1) as new_avg_click_count,
  round(
    avg(coalesce(m.field_change_count, 0)) filter (where m.mode = 'new')::numeric,
    1
  ) as new_avg_field_change_count,
  round(
    avg(case when m.used_template_copy then 100 else 0 end) filter (where m.mode = 'new')::numeric,
    1
  ) as new_template_copy_rate
from public.appointment_metrics m
where m.event_type = 'appointment_form_submit'
group by m.store_id, timezone('Asia/Tokyo', m.created_at)::date;

comment on view public.appointment_form_metric_daily_summary_v is
  'JST日付単位の予約フォーム入力KPI。新規優先表示と日次推移の差し替え用。';


create or replace view public.appointment_duration_kpi_daily_summary_v
with (security_invoker = true) as
with appointment_base as (
  select
    a.store_id,
    timezone('Asia/Tokyo', a.start_time)::date as date_key,
    a.status,
    a.duration,
    greatest(
      0,
      round(
        abs(
          extract(
            epoch
            from ((a.start_time + make_interval(mins => a.duration)) - a.end_time)
          )
        ) / 60.0
      )
    )::integer as estimation_error_min
  from public.appointments a
  where a.status not in ('キャンセル', '無断キャンセル')
    and a.start_time is not null
    and a.end_time is not null
    and a.duration is not null
    and a.duration > 0
)
select
  store_id,
  date_key,
  count(*) as comparable_appointment_count,
  count(*) filter (where status in ('完了', '来店済')) as completed_count,
  round(avg(estimation_error_min)::numeric, 1) as avg_estimation_error_min,
  count(*) filter (where estimation_error_min <= 10) as within_10_min_count,
  round(
    (
      count(*) filter (where estimation_error_min <= 10)::numeric
      / nullif(count(*), 0)::numeric
    ) * 100,
    1
  ) as within_10_min_rate
from appointment_base
group by store_id, date_key;

comment on view public.appointment_duration_kpi_daily_summary_v is
  'JST日付単位の予約所要時間誤差KPI。見積誤差平均と±10分以内率の差し替え用。';


create or replace view public.appointment_staff_gap_kpi_daily_summary_v
with (security_invoker = true) as
with active_appointments as (
  select
    a.store_id,
    a.staff_id,
    timezone('Asia/Tokyo', a.start_time)::date as date_key,
    a.start_time,
    a.end_time
  from public.appointments a
  where a.status not in ('キャンセル', '無断キャンセル')
    and a.staff_id is not null
    and a.start_time is not null
    and a.end_time is not null
),
sequenced as (
  select
    aa.store_id,
    aa.staff_id,
    aa.date_key,
    aa.start_time,
    lag(aa.end_time) over (
      partition by aa.store_id, aa.staff_id, aa.date_key
      order by aa.start_time
    ) as previous_end_time
  from active_appointments aa
)
select
  store_id,
  date_key,
  count(*) filter (where previous_end_time is not null) as sequential_pair_count,
  count(*) filter (
    where previous_end_time is not null
      and extract(epoch from (start_time - previous_end_time)) / 60.0 < 10
  ) as pushed_pair_count,
  round(
    (
      count(*) filter (
        where previous_end_time is not null
          and extract(epoch from (start_time - previous_end_time)) / 60.0 < 10
      )::numeric
      / nullif(count(*) filter (where previous_end_time is not null), 0)::numeric
    ) * 100,
    1
  ) as pushed_rate
from sequenced
group by store_id, date_key;

comment on view public.appointment_staff_gap_kpi_daily_summary_v is
  'JST日付単位の同一スタッフ連続予約ギャップKPI。押し予約発生率の差し替え用。';


create or replace view public.completed_appointment_daily_summary_v
with (security_invoker = true) as
select
  a.store_id,
  timezone('Asia/Tokyo', a.start_time)::date as date_key,
  count(*) as completed_count
from public.appointments a
where a.status in ('完了', '来店済')
  and a.start_time is not null
group by a.store_id, timezone('Asia/Tokyo', a.start_time)::date;

comment on view public.completed_appointment_daily_summary_v is
  'JST日付単位の完了/来店済件数サマリ。1日あたり処理件数の差し替え用。';


create or replace view public.completed_appointment_revisit_source_v
with (security_invoker = true) as
with completed_visits as (
  select
    a.store_id,
    a.id as appointment_id,
    a.customer_id,
    a.pet_id,
    a.start_time,
    timezone('Asia/Tokyo', a.start_time)::date as date_key
  from public.appointments a
  where a.status in ('完了', '来店済')
    and a.customer_id is not null
    and a.pet_id is not null
    and a.start_time is not null
),
annotated as (
  select
    cv.store_id,
    cv.appointment_id,
    cv.customer_id,
    cv.pet_id,
    cv.start_time,
    cv.date_key,
    exists (
      select 1
      from public.appointments future_a
      where future_a.store_id = cv.store_id
        and future_a.customer_id = cv.customer_id
        and future_a.pet_id = cv.pet_id
        and future_a.id <> cv.appointment_id
        and future_a.status not in ('キャンセル', '無断キャンセル')
        and future_a.start_time is not null
        and future_a.start_time > cv.start_time
    ) as has_next_booking
  from completed_visits cv
)
select
  store_id,
  appointment_id,
  customer_id,
  pet_id,
  start_time,
  date_key,
  has_next_booking,
  (
    not has_next_booking
    and floor(extract(epoch from (now() - start_time)) / 86400.0) >= 45
  ) as is_revisit_leak
from annotated;

comment on view public.completed_appointment_revisit_source_v is
  '完了/来店済予約ごとの後続予約有無と再来店漏れ判定。次回予約化率と再来店漏れ件数の差し替え用。';


create or replace view public.no_show_customer_kpi_source_v
with (security_invoker = true) as
select
  a.store_id,
  a.customer_id,
  count(*) as no_show_count,
  (count(*) >= 2) as is_repeated_no_show
from public.appointments a
where a.status = '無断キャンセル'
  and a.customer_id is not null
group by a.store_id, a.customer_id;

comment on view public.no_show_customer_kpi_source_v is
  '顧客単位の無断キャンセル回数サマリ。無断キャンセル再発率の差し替え用。';

commit;
