begin;

create or replace function public.current_user_store_role(target_store_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sm.role
  from public.store_memberships sm
  where sm.store_id = target_store_id
    and sm.user_id = auth.uid()
    and sm.is_active = true
  limit 1;
$$;

create or replace function public.is_valid_followup_days(value integer[])
returns boolean
language sql
immutable
as $$
  select
    coalesce(array_length(value, 1), 0) between 1 and 6
    and not exists (
      select 1
      from unnest(value) as day_value
      where day_value < 1 or day_value > 365
    );
$$;

create table if not exists public.store_notification_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  reminder_line_enabled boolean not null default true,
  reminder_email_enabled boolean not null default true,
  reminder_day_before_enabled boolean not null default true,
  reminder_same_day_enabled boolean not null default true,
  reminder_day_before_send_hour_jst integer not null default 18 check (
    reminder_day_before_send_hour_jst >= 0 and reminder_day_before_send_hour_jst <= 23
  ),
  reminder_same_day_send_hour_jst integer not null default 9 check (
    reminder_same_day_send_hour_jst >= 0 and reminder_same_day_send_hour_jst <= 23
  ),
  followup_line_enabled boolean not null default true,
  followup_days integer[] not null default array[30, 60],
  slot_reoffer_line_enabled boolean not null default true,
  notification_option_enabled boolean not null default false,
  monthly_message_limit integer not null default 1000 check (monthly_message_limit >= 0),
  monthly_message_limit_with_option integer not null default 3000 check (monthly_message_limit_with_option >= monthly_message_limit),
  over_limit_behavior text not null default 'queue' check (over_limit_behavior in ('queue', 'block')),
  check (public.is_valid_followup_days(followup_days))
);

alter table public.store_notification_settings enable row level security;

drop policy if exists store_notification_settings_select_store on public.store_notification_settings;
create policy store_notification_settings_select_store
on public.store_notification_settings
for select to authenticated
using (store_id in (select public.current_user_store_ids()));

drop policy if exists store_notification_settings_modify_owner_admin on public.store_notification_settings;
create policy store_notification_settings_modify_owner_admin
on public.store_notification_settings
for all to authenticated
using (public.current_user_store_role(store_id) in ('owner', 'admin'))
with check (public.current_user_store_role(store_id) in ('owner', 'admin'));

commit;
