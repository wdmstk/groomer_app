begin;

-- =========================================================
-- Dashboard summary views
-- =========================================================
-- Purpose:
-- - Move frequently used dashboard aggregations out of page-level TypeScript reduce logic.
-- - Keep the first step narrow: daily appointment/payment summary, followup daily summary,
--   and reoffer daily summary.
-- - All dates are normalized to JST business dates.
-- =========================================================

create or replace view public.appointment_daily_summary_v
with (security_invoker = true) as
with appointment_menu_totals as (
  select
    am.store_id,
    am.appointment_id,
    sum(
      case
        when coalesce(am.tax_included, true)
          then am.price
        else am.price * (1 + coalesce(am.tax_rate, 0.1))
      end
    ) as expected_total_amount
  from public.appointment_menus am
  group by am.store_id, am.appointment_id
),
appointment_base as (
  select
    a.store_id,
    timezone('Asia/Tokyo', a.start_time)::date as date_key,
    a.id,
    a.status,
    coalesce(mt.expected_total_amount, 0)::numeric as expected_total_amount
  from public.appointments a
  left join appointment_menu_totals mt
    on mt.store_id = a.store_id
   and mt.appointment_id = a.id
)
select
  store_id,
  date_key,
  count(*) as appointment_count,
  count(*) filter (where status in ('完了', '来店済')) as completed_count,
  count(*) filter (where status not in ('キャンセル', '無断キャンセル')) as active_appointment_count,
  count(*) filter (where status = '予約申請') as requested_count,
  sum(case when status not in ('キャンセル', '無断キャンセル') then expected_total_amount else 0 end) as expected_sales
from appointment_base
group by store_id, date_key;

comment on view public.appointment_daily_summary_v is
  'JST日付単位の予約件数/見込売上サマリ。dashboard の日次サマリ差し替え用。';


create or replace view public.payment_daily_summary_v
with (security_invoker = true) as
select
  p.store_id,
  timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date as date_key,
  count(*) as payment_count,
  count(*) filter (where p.status = '支払済') as paid_count,
  sum(case when p.status = '支払済' then coalesce(p.total_amount, 0) else 0 end) as confirmed_sales
from public.payments p
group by p.store_id, timezone('Asia/Tokyo', coalesce(p.paid_at, p.created_at))::date;

comment on view public.payment_daily_summary_v is
  'JST日付単位の会計件数/確定売上サマリ。dashboard の確定売上差し替え用。';


create or replace view public.visit_daily_summary_v
with (security_invoker = true) as
select
  v.store_id,
  timezone('Asia/Tokyo', v.visit_date)::date as date_key,
  count(*) as visit_count
from public.visits v
group by v.store_id, timezone('Asia/Tokyo', v.visit_date)::date;

comment on view public.visit_daily_summary_v is
  'JST日付単位の来店件数サマリ。dashboard の来店済み件数差し替え用。';


create or replace view public.followup_daily_summary_v
with (security_invoker = true) as
select
  t.store_id,
  timezone('Asia/Tokyo', t.recommended_at)::date as date_key,
  count(*) as task_count,
  count(*) filter (where t.status = 'open') as open_count,
  count(*) filter (where t.status = 'in_progress') as in_progress_count,
  count(*) filter (where t.status = 'snoozed') as snoozed_count,
  count(*) filter (where t.status = 'resolved_booked') as resolved_booked_count,
  count(*) filter (where t.status = 'resolved_no_need') as resolved_no_need_count,
  count(*) filter (where t.status = 'resolved_lost') as resolved_lost_count,
  count(*) filter (where t.due_on = timezone('Asia/Tokyo', now())::date) as due_today_count,
  count(*) filter (where t.status <> 'open') as touched_count,
  count(*) filter (
    where exists (
      select 1
      from public.customer_followup_events e
      where e.store_id = t.store_id
        and e.task_id = t.id
        and e.event_type = 'snoozed'
    )
  ) as renotified_count
from public.customer_followup_tasks t
group by t.store_id, timezone('Asia/Tokyo', t.recommended_at)::date;

comment on view public.followup_daily_summary_v is
  'JST日付単位の再来店フォロー件数サマリ。window 集計のベース用。';


create or replace view public.reoffer_daily_summary_v
with (security_invoker = true) as
with reoffer_created as (
  select
    r.store_id,
    r.id,
    timezone('Asia/Tokyo', coalesce(r.accepted_at, r.sent_at, r.created_at))::date as date_key,
    r.status
  from public.slot_reoffers r
),
reoffer_booked as (
  select distinct
    l.store_id,
    l.slot_reoffer_id
  from public.slot_reoffer_logs l
  where l.event_type = 'appointment_created'
),
phone_logs as (
  select
    n.store_id,
    timezone('Asia/Tokyo', n.sent_at)::date as date_key,
    count(*) filter (where n.channel = 'phone') as phone_contact_count,
    count(*) filter (where n.channel = 'phone' and n.payload ->> 'result' = 'connected') as connected_call_count
  from public.customer_notification_logs n
  where n.notification_type = 'slot_reoffer'
  group by n.store_id, timezone('Asia/Tokyo', n.sent_at)::date
)
select
  r.store_id,
  r.date_key,
  count(*) as total_count,
  count(*) filter (where r.status = 'accepted') as accepted_count,
  count(*) filter (where b.slot_reoffer_id is not null) as booked_count,
  coalesce(max(p.phone_contact_count), 0) as phone_contact_count,
  coalesce(max(p.connected_call_count), 0) as connected_call_count
from reoffer_created r
left join reoffer_booked b
  on b.store_id = r.store_id
 and b.slot_reoffer_id = r.id
left join phone_logs p
  on p.store_id = r.store_id
 and p.date_key = r.date_key
group by r.store_id, r.date_key;

comment on view public.reoffer_daily_summary_v is
  'JST日付単位の空き枠再販件数サマリ。window 集計のベース用。';

commit;
