begin;

alter table if exists public.store_customer_management_settings
  add column if not exists followup_snoozed_refollow_days integer not null default 7,
  add column if not exists followup_no_need_refollow_days integer not null default 60,
  add column if not exists followup_lost_refollow_days integer not null default 90;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_customer_management_settings_followup_snoozed_refollow_days_check'
  ) then
    alter table public.store_customer_management_settings
      add constraint store_customer_management_settings_followup_snoozed_refollow_days_check
      check (followup_snoozed_refollow_days >= 1 and followup_snoozed_refollow_days <= 365);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_customer_management_settings_followup_no_need_refollow_days_check'
  ) then
    alter table public.store_customer_management_settings
      add constraint store_customer_management_settings_followup_no_need_refollow_days_check
      check (followup_no_need_refollow_days >= 1 and followup_no_need_refollow_days <= 365);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'store_customer_management_settings_followup_lost_refollow_days_check'
  ) then
    alter table public.store_customer_management_settings
      add constraint store_customer_management_settings_followup_lost_refollow_days_check
      check (followup_lost_refollow_days >= 1 and followup_lost_refollow_days <= 365);
  end if;
end $$;

comment on column public.store_customer_management_settings.followup_snoozed_refollow_days is
  '再来店フォローで保留（snoozed）時に再フォロー候補へ戻す日数';
comment on column public.store_customer_management_settings.followup_no_need_refollow_days is
  '再来店フォローで不要（resolved_no_need）時に再フォロー候補へ戻す日数';
comment on column public.store_customer_management_settings.followup_lost_refollow_days is
  '再来店フォローで失注（resolved_lost）時に再フォロー候補へ戻す日数';

commit;
