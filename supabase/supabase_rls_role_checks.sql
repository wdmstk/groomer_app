-- RLS role checks for support / followup / slot reoffer related tables.
-- Run in Supabase SQL Editor as authenticated context.

-- =========================================================
-- 1) Target tables: RLS enabled check
-- =========================================================
with target_tables(table_name) as (
  values
    ('support_tickets'),
    ('support_ticket_events'),
    ('customer_followup_tasks'),
    ('customer_followup_events'),
    ('slot_reoffers'),
    ('slot_reoffer_logs')
)
select
  t.table_name,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as force_rls
from target_tables t
left join pg_class c
  on c.relname = t.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by t.table_name;

-- =========================================================
-- 2) Policy detail dump
-- =========================================================
select
  p.tablename as table_name,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual as using_expr,
  p.with_check
from pg_policies p
where p.schemaname = 'public'
  and p.tablename in (
    'support_tickets',
    'support_ticket_events',
    'customer_followup_tasks',
    'customer_followup_events',
    'slot_reoffers',
    'slot_reoffer_logs'
  )
order by p.tablename, p.policyname;

-- =========================================================
-- 3) Required policy matrix check (authenticated should have CRUD)
--    Note: cmd='ALL' is counted for all operations.
-- =========================================================
with target_tables(table_name) as (
  values
    ('support_tickets'),
    ('support_ticket_events'),
    ('customer_followup_tasks'),
    ('customer_followup_events'),
    ('slot_reoffers'),
    ('slot_reoffer_logs')
),
policy_flags as (
  select
    t.table_name,
    bool_or(
      p.cmd in ('ALL', 'SELECT')
      and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
    ) as has_select,
    bool_or(
      p.cmd in ('ALL', 'INSERT')
      and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
    ) as has_insert,
    bool_or(
      p.cmd in ('ALL', 'UPDATE')
      and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
    ) as has_update,
    bool_or(
      p.cmd in ('ALL', 'DELETE')
      and ('authenticated' = any(p.roles) or 'public' = any(p.roles))
    ) as has_delete
  from target_tables t
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = t.table_name
  group by t.table_name
)
select
  table_name,
  has_select,
  has_insert,
  has_update,
  has_delete,
  case
    when has_select and has_insert and has_update and has_delete then true
    else false
  end as crud_policy_is_complete
from policy_flags
order by table_name;

-- =========================================================
-- 4) Store scope sanity sample
--    If this returns multiple stores in one session, verify membership config.
-- =========================================================
select
  current_user as db_user,
  public.current_user_store_ids() as current_user_store_ids;

