begin;

alter table if exists public.store_subscriptions
  add column if not exists notification_option_enabled boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'store_notification_settings'
  ) then
    update public.store_subscriptions as ss
    set notification_option_enabled = sns.notification_option_enabled
    from public.store_notification_settings as sns
    where sns.store_id = ss.store_id
      and ss.notification_option_enabled is distinct from sns.notification_option_enabled;
  end if;
end
$$;

commit;
