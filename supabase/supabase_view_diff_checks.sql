-- Diff checks for dashboard / appointments-kpi view migration.
-- Replace the params.store_id value before running.

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as store_id,
    timezone('Asia/Tokyo', now())::date as today_jst,
    30::integer as kpi_window_days,
    500::integer as kpi_appointment_limit
)

-- =========================================================
-- 1. dashboard top summary diff
-- =========================================================
, raw_dashboard_appointment as (
  select
    a.store_id,
    timezone('Asia/Tokyo', a.start_time)::date as date_key,
    count(*) as appointment_count,
    sum(
      case
        when a.status not in ('キャンセル', '無断キャンセル') then coalesce(mt.expected_total_amount, 0)
        else 0
      end
    ) as expected_sales
  from public.appointments a
  left join (
    select
      am.store_id,
      am.appointment_id,
      sum(
        case
          when coalesce(am.tax_included, true) then am.price
          else am.price * (1 + coalesce(am.tax_rate, 0.1))
        end
      ) as expected_total_amount
    from public.appointment_menus am
    group by am.store_id, am.appointment_id
  ) mt
    on mt.store_id = a.store_id
   and mt.appointment_id = a.id
  join params p
    on p.store_id = a.store_id
  where timezone('Asia/Tokyo', a.start_time)::date = p.today_jst
  group by a.store_id, timezone('Asia/Tokyo', a.start_time)::date
)
, raw_dashboard_payment as (
  select
    p.store_id,
    timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date as date_key,
    sum(case when p.status = '支払済' then coalesce(p.total_amount, 0) else 0 end) as confirmed_sales
  from public.payments p
  join params prm
    on prm.store_id = p.store_id
  where timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date = prm.today_jst
  group by p.store_id, timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date
)
, raw_dashboard_visit as (
  select
    v.store_id,
    timezone('Asia/Tokyo', v.visit_date)::date as date_key,
    count(*) as visit_count
  from public.visits v
  join params p
    on p.store_id = v.store_id
  where timezone('Asia/Tokyo', v.visit_date)::date = p.today_jst
  group by v.store_id, timezone('Asia/Tokyo', v.visit_date)::date
)
select
  'dashboard_top_summary' as check_name,
  p.store_id,
  p.today_jst as date_key,
  coalesce(v1.appointment_count, 0) as view_appointment_count,
  coalesce(r1.appointment_count, 0) as raw_appointment_count,
  coalesce(v1.expected_sales, 0) as view_expected_sales,
  coalesce(r1.expected_sales, 0) as raw_expected_sales,
  coalesce(v2.confirmed_sales, 0) as view_confirmed_sales,
  coalesce(r2.confirmed_sales, 0) as raw_confirmed_sales,
  coalesce(v3.visit_count, 0) as view_visit_count,
  coalesce(r3.visit_count, 0) as raw_visit_count
from params p
left join public.appointment_daily_summary_v v1
  on v1.store_id = p.store_id
 and v1.date_key = p.today_jst
left join raw_dashboard_appointment r1
  on r1.store_id = p.store_id
 and r1.date_key = p.today_jst
left join public.payment_daily_summary_v v2
  on v2.store_id = p.store_id
 and v2.date_key = p.today_jst
left join raw_dashboard_payment r2
  on r2.store_id = p.store_id
 and r2.date_key = p.today_jst
left join public.visit_daily_summary_v v3
  on v3.store_id = p.store_id
 and v3.date_key = p.today_jst
left join raw_dashboard_visit r3
  on r3.store_id = p.store_id
 and r3.date_key = p.today_jst;

-- =========================================================
-- 2. appointments-kpi daily view diffs
-- =========================================================

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as store_id,
    (timezone('Asia/Tokyo', now())::date - 29) as start_date,
    timezone('Asia/Tokyo', now())::date as end_date,
    500::integer as kpi_appointment_limit
)
, raw_form_daily as (
  select
    m.store_id,
    timezone('Asia/Tokyo', m.created_at)::date as date_key,
    count(*) as submission_count,
    count(*) filter (where m.mode = 'new') as new_submission_count,
    round(avg(coalesce(m.elapsed_ms, 0))::numeric, 1) as avg_elapsed_ms,
    round(avg(coalesce(m.click_count, 0))::numeric, 1) as avg_click_count,
    round(avg(coalesce(m.field_change_count, 0))::numeric, 1) as avg_field_change_count,
    round(avg(case when m.used_template_copy then 100 else 0 end)::numeric, 1) as template_copy_rate,
    round(avg(coalesce(m.elapsed_ms, 0)) filter (where m.mode = 'new')::numeric, 1) as new_avg_elapsed_ms,
    round(avg(coalesce(m.click_count, 0)) filter (where m.mode = 'new')::numeric, 1) as new_avg_click_count,
    round(avg(coalesce(m.field_change_count, 0)) filter (where m.mode = 'new')::numeric, 1) as new_avg_field_change_count,
    round(avg(case when m.used_template_copy then 100 else 0 end) filter (where m.mode = 'new')::numeric, 1) as new_template_copy_rate
  from public.appointment_metrics m
  join params p
    on p.store_id = m.store_id
  where m.event_type = 'appointment_form_submit'
    and timezone('Asia/Tokyo', m.created_at)::date between p.start_date and p.end_date
  group by m.store_id, timezone('Asia/Tokyo', m.created_at)::date
)
select
  'appointment_form_metric_daily_summary_v' as check_name,
  coalesce(v.store_id, r.store_id) as store_id,
  coalesce(v.date_key, r.date_key) as date_key,
  v.submission_count as view_submission_count,
  r.submission_count as raw_submission_count,
  v.new_submission_count as view_new_submission_count,
  r.new_submission_count as raw_new_submission_count,
  v.avg_elapsed_ms as view_avg_elapsed_ms,
  r.avg_elapsed_ms as raw_avg_elapsed_ms,
  v.avg_click_count as view_avg_click_count,
  r.avg_click_count as raw_avg_click_count,
  v.avg_field_change_count as view_avg_field_change_count,
  r.avg_field_change_count as raw_avg_field_change_count,
  v.template_copy_rate as view_template_copy_rate,
  r.template_copy_rate as raw_template_copy_rate
from public.appointment_form_metric_daily_summary_v v
full outer join raw_form_daily r
  on r.store_id = v.store_id
 and r.date_key = v.date_key
join params p
  on p.store_id = coalesce(v.store_id, r.store_id)
where coalesce(v.date_key, r.date_key) between p.start_date and p.end_date
order by date_key desc;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as store_id,
    (timezone('Asia/Tokyo', now())::date - 29) as start_date,
    timezone('Asia/Tokyo', now())::date as end_date
)
, raw_duration_daily as (
  select
    a.store_id,
    timezone('Asia/Tokyo', a.start_time)::date as date_key,
    count(*) as comparable_appointment_count,
    count(*) filter (where a.status in ('完了', '来店済')) as completed_count,
    round(
      avg(
        greatest(
          0,
          round(abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time)) / 60.0))
        )::integer
      )::numeric,
      1
    ) as avg_estimation_error_min,
    count(*) filter (
      where greatest(
        0,
        round(abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time)) / 60.0))
      )::integer <= 10
    ) as within_10_min_count
  from public.appointments a
  join params p
    on p.store_id = a.store_id
  where a.status not in ('キャンセル', '無断キャンセル')
    and a.start_time is not null
    and a.end_time is not null
    and a.duration is not null
    and a.duration > 0
    and timezone('Asia/Tokyo', a.start_time)::date between p.start_date and p.end_date
  group by a.store_id, timezone('Asia/Tokyo', a.start_time)::date
)
select
  'appointment_duration_kpi_daily_summary_v' as check_name,
  coalesce(v.store_id, r.store_id) as store_id,
  coalesce(v.date_key, r.date_key) as date_key,
  v.comparable_appointment_count as view_comparable_appointment_count,
  r.comparable_appointment_count as raw_comparable_appointment_count,
  v.completed_count as view_completed_count,
  r.completed_count as raw_completed_count,
  v.avg_estimation_error_min as view_avg_estimation_error_min,
  r.avg_estimation_error_min as raw_avg_estimation_error_min,
  v.within_10_min_count as view_within_10_min_count,
  r.within_10_min_count as raw_within_10_min_count
from public.appointment_duration_kpi_daily_summary_v v
full outer join raw_duration_daily r
  on r.store_id = v.store_id
 and r.date_key = v.date_key
join params p
  on p.store_id = coalesce(v.store_id, r.store_id)
where coalesce(v.date_key, r.date_key) between p.start_date and p.end_date
order by date_key desc;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as store_id,
    (timezone('Asia/Tokyo', now())::date - 29) as start_date,
    timezone('Asia/Tokyo', now())::date as end_date
)
, raw_staff_gap_daily as (
  with active_appointments as (
    select
      a.store_id,
      a.staff_id,
      timezone('Asia/Tokyo', a.start_time)::date as date_key,
      a.start_time,
      a.end_time
    from public.appointments a
    join params p
      on p.store_id = a.store_id
    where a.status not in ('キャンセル', '無断キャンセル')
      and a.staff_id is not null
      and a.start_time is not null
      and a.end_time is not null
      and timezone('Asia/Tokyo', a.start_time)::date between p.start_date and p.end_date
  )
  select
    store_id,
    date_key,
    count(*) filter (where previous_end_time is not null) as sequential_pair_count,
    count(*) filter (
      where previous_end_time is not null
        and extract(epoch from (start_time - previous_end_time)) / 60.0 < 10
    ) as pushed_pair_count
  from (
    select
      aa.*,
      lag(aa.end_time) over (
        partition by aa.store_id, aa.staff_id, aa.date_key
        order by aa.start_time
      ) as previous_end_time
    from active_appointments aa
  ) seq
  group by store_id, date_key
)
select
  'appointment_staff_gap_kpi_daily_summary_v' as check_name,
  coalesce(v.store_id, r.store_id) as store_id,
  coalesce(v.date_key, r.date_key) as date_key,
  v.sequential_pair_count as view_sequential_pair_count,
  r.sequential_pair_count as raw_sequential_pair_count,
  v.pushed_pair_count as view_pushed_pair_count,
  r.pushed_pair_count as raw_pushed_pair_count
from public.appointment_staff_gap_kpi_daily_summary_v v
full outer join raw_staff_gap_daily r
  on r.store_id = v.store_id
 and r.date_key = v.date_key
join params p
  on p.store_id = coalesce(v.store_id, r.store_id)
where coalesce(v.date_key, r.date_key) between p.start_date and p.end_date
order by date_key desc;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as store_id,
    500::integer as kpi_appointment_limit
)
, raw_completed_visits as (
  select
    a.id,
    a.store_id,
    a.customer_id,
    a.pet_id,
    a.start_time
  from public.appointments a
  join params p
    on p.store_id = a.store_id
  where a.status in ('完了', '来店済')
    and a.customer_id is not null
    and a.pet_id is not null
    and a.start_time is not null
  order by a.start_time desc
  limit (select kpi_appointment_limit from params)
)
, raw_revisit as (
  select
    rv.id as appointment_id,
    exists (
      select 1
      from public.appointments future_a
      where future_a.store_id = rv.store_id
        and future_a.customer_id = rv.customer_id
        and future_a.pet_id = rv.pet_id
        and future_a.id <> rv.id
        and future_a.status not in ('キャンセル', '無断キャンセル')
        and future_a.start_time is not null
        and future_a.start_time > rv.start_time
    ) as has_next_booking,
    (
      not exists (
        select 1
        from public.appointments future_a
        where future_a.store_id = rv.store_id
          and future_a.customer_id = rv.customer_id
          and future_a.pet_id = rv.pet_id
          and future_a.id <> rv.id
          and future_a.status not in ('キャンセル', '無断キャンセル')
          and future_a.start_time is not null
          and future_a.start_time > rv.start_time
      )
      and floor(extract(epoch from (now() - rv.start_time)) / 86400.0) >= 45
    ) as is_revisit_leak
  from raw_completed_visits rv
)
select
  'completed_appointment_revisit_source_v' as check_name,
  count(*) filter (where coalesce(v.has_next_booking, false) <> r.has_next_booking) as has_next_booking_diff_count,
  count(*) filter (where coalesce(v.is_revisit_leak, false) <> r.is_revisit_leak) as revisit_leak_diff_count
from raw_revisit r
left join public.completed_appointment_revisit_source_v v
  on v.appointment_id = r.appointment_id;

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as store_id
)
, raw_no_show as (
  select
    a.customer_id,
    count(*) as no_show_count,
    (count(*) >= 2) as is_repeated_no_show
  from public.appointments a
  join params p
    on p.store_id = a.store_id
  where a.status = '無断キャンセル'
    and a.customer_id is not null
  group by a.customer_id
)
select
  'no_show_customer_kpi_source_v' as check_name,
  count(*) filter (where coalesce(v.no_show_count, 0) <> r.no_show_count) as no_show_count_diff_count,
  count(*) filter (where coalesce(v.is_repeated_no_show, false) <> r.is_repeated_no_show) as repeated_flag_diff_count
from raw_no_show r
left join public.no_show_customer_kpi_source_v v
  on v.store_id = (select store_id from params)
 and v.customer_id = r.customer_id;
