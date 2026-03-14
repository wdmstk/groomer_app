-- Backfill script for appointment end_time normalization.
-- Goal: enforce end_time = start_time + duration for existing mismatched rows.
--
-- Recommended run order:
-- 1) Run the preview queries.
-- 2) Run UPDATE block.
-- 3) Run post-check queries.

-- =========================================================
-- 1) Preview target rows
-- =========================================================

select
  count(*) as target_count,
  round(
    avg(abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) / 60.0)::numeric,
    2
  ) as avg_diff_min,
  max(abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) / 60.0) as max_diff_min
from public.appointments a
where a.status not in ('キャンセル', '無断キャンセル')
  and a.start_time is not null
  and a.end_time is not null
  and a.duration is not null
  and a.duration > 0
  and abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) >= 60;

select
  a.id,
  a.store_id,
  a.status,
  a.start_time,
  a.duration,
  a.end_time as current_end_time,
  (a.start_time + make_interval(mins => a.duration)) as normalized_end_time,
  round((extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time)) / 60.0)::numeric, 2) as diff_min
from public.appointments a
where a.status not in ('キャンセル', '無断キャンセル')
  and a.start_time is not null
  and a.end_time is not null
  and a.duration is not null
  and a.duration > 0
  and abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) >= 60
order by a.start_time desc
limit 200;

-- =========================================================
-- 2) Backfill
-- =========================================================

begin;

with target as (
  select
    a.id,
    (a.start_time + make_interval(mins => a.duration)) as normalized_end_time
  from public.appointments a
  where a.status not in ('キャンセル', '無断キャンセル')
    and a.start_time is not null
    and a.end_time is not null
    and a.duration is not null
    and a.duration > 0
    and abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) >= 60
),
updated as (
  update public.appointments a
  set
    end_time = t.normalized_end_time,
    updated_at = now()
  from target t
  where a.id = t.id
  returning a.id, a.store_id, a.start_time, a.duration, a.end_time
)
select count(*) as updated_count from updated;

commit;

-- =========================================================
-- 3) Post-check
-- =========================================================

select
  count(*) as mismatch_count_after_backfill
from public.appointments a
where a.status not in ('キャンセル', '無断キャンセル')
  and a.start_time is not null
  and a.end_time is not null
  and a.duration is not null
  and a.duration > 0
  and abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) >= 60;

select
  date_trunc('month', a.start_time) as month_bucket,
  count(*) as mismatch_count
from public.appointments a
where a.status not in ('キャンセル', '無断キャンセル')
  and a.start_time is not null
  and a.end_time is not null
  and a.duration is not null
  and a.duration > 0
  and abs(extract(epoch from ((a.start_time + make_interval(mins => a.duration)) - a.end_time))) >= 60
group by 1
order by 1 desc;
