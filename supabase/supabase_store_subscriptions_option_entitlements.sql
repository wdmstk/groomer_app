begin;

alter table if exists public.store_subscriptions
  add column if not exists ai_plan_code_requested text;

alter table if exists public.store_subscriptions
  add column if not exists ai_plan_code_effective text;

alter table if exists public.store_subscriptions
  add column if not exists hotel_option_requested boolean;

alter table if exists public.store_subscriptions
  add column if not exists hotel_option_effective boolean;

alter table if exists public.store_subscriptions
  add column if not exists notification_option_requested boolean;

alter table if exists public.store_subscriptions
  add column if not exists notification_option_effective boolean;

update public.store_subscriptions
set
  ai_plan_code_requested = coalesce(ai_plan_code_requested, ai_plan_code, 'none'),
  ai_plan_code_effective = coalesce(ai_plan_code_effective, ai_plan_code, 'none'),
  hotel_option_requested = coalesce(hotel_option_requested, hotel_option_enabled, false),
  hotel_option_effective = coalesce(hotel_option_effective, hotel_option_enabled, false),
  notification_option_requested = coalesce(notification_option_requested, notification_option_enabled, false),
  notification_option_effective = coalesce(notification_option_effective, notification_option_enabled, false);

alter table public.store_subscriptions
  alter column ai_plan_code_requested set default 'none',
  alter column ai_plan_code_requested set not null;

alter table public.store_subscriptions
  alter column ai_plan_code_effective set default 'none',
  alter column ai_plan_code_effective set not null;

alter table public.store_subscriptions
  alter column hotel_option_requested set default false,
  alter column hotel_option_requested set not null;

alter table public.store_subscriptions
  alter column hotel_option_effective set default false,
  alter column hotel_option_effective set not null;

alter table public.store_subscriptions
  alter column notification_option_requested set default false,
  alter column notification_option_requested set not null;

alter table public.store_subscriptions
  alter column notification_option_effective set default false,
  alter column notification_option_effective set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_subscriptions_ai_plan_code_requested_check'
  ) then
    alter table public.store_subscriptions
      add constraint store_subscriptions_ai_plan_code_requested_check
      check (ai_plan_code_requested in ('none', 'assist', 'pro', 'pro_plus'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_subscriptions_ai_plan_code_effective_check'
  ) then
    alter table public.store_subscriptions
      add constraint store_subscriptions_ai_plan_code_effective_check
      check (ai_plan_code_effective in ('none', 'assist', 'pro', 'pro_plus'));
  end if;
end $$;

commit;
