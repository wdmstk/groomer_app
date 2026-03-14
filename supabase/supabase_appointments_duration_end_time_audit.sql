-- Audit queries for appointments where `start_time + duration != end_time`.
-- Run these before deciding the backfill strategy for duration/end_time normalization.

-- 1. Summary count excluding canceled statuses.
select
  count(*) as mismatch_count,
  round(avg(abs(extract(epoch from ((start_time + make_interval(mins => duration)) - end_time))) / 60.0)::numeric, 2) as avg_diff_min,
  max(abs(extract(epoch from ((start_time + make_interval(mins => duration)) - end_time))) / 60.0) as max_diff_min
from public.appointments
where status not in ('キャンセル', '無断キャンセル')
  and duration is not null
  and start_time is not null
  and end_time is not null
  and abs(extract(epoch from ((start_time + make_interval(mins => duration)) - end_time))) >= 60;

-- 2. Recent mismatches for manual inspection.
select
  id,
  store_id,
  customer_id,
  pet_id,
  staff_id,
  status,
  start_time,
  duration,
  end_time,
  (start_time + make_interval(mins => duration)) as expected_end_time,
  round((extract(epoch from ((start_time + make_interval(mins => duration)) - end_time)) / 60.0)::numeric, 2) as diff_min
from public.appointments
where status not in ('キャンセル', '無断キャンセル')
  and duration is not null
  and start_time is not null
  and end_time is not null
  and abs(extract(epoch from ((start_time + make_interval(mins => duration)) - end_time))) >= 60
order by start_time desc
limit 200;

-- 3. Monthly distribution to see whether mismatches are historical or still ongoing.
select
  date_trunc('month', start_time) as month_bucket,
  count(*) as mismatch_count,
  round(avg(abs(extract(epoch from ((start_time + make_interval(mins => duration)) - end_time))) / 60.0)::numeric, 2) as avg_diff_min
from public.appointments
where status not in ('キャンセル', '無断キャンセル')
  and duration is not null
  and start_time is not null
  and end_time is not null
  and abs(extract(epoch from ((start_time + make_interval(mins => duration)) - end_time))) >= 60
group by 1
order by 1 desc;
